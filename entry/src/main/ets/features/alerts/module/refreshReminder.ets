import notificationManager from '@ohos.notificationManager';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { calendarReminder } from './calendarReminder';
import { kvGetBool, kvSet } from '../../../infra/storage/kv';
import {
  REFRESH_REMINDER_KINDS, REFRESH_REMINDER_PREFIX, REFRESH_REMINDER_STATUS,
  RefreshReminderKind, RefreshReminderTarget, refreshReminderKey, refreshReminderTargets,
} from './refreshSchedule';

function reminderFailure(error: BusinessError): string {
  const code = error.code;
  let reason = '系统提醒失败';
  if (code === 401 || code === 1700007) reason = '提醒参数无效';
  else if (code === 201) reason = '缺少代理提醒权限';
  else if (code === 1700001) reason = '系统通知未开启';
  else if (code === 1700002) reason = '系统提醒数量已达上限';
  return `${reason}（${code ?? '未知错误码'}）：${error.message || '系统未返回具体原因'}`;
}

/** Notification-only deadlines, independent of AlertBus's toast/vibration preferences. */
class RefreshReminderService {
  private running: boolean = false;
  private timer: number | null = null;
  private tail: Promise<void> = Promise.resolve();

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.sync();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    // The system keeps delivering registered reminders after the process exits.
  }

  private schedule(): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.sync();
      this.schedule();
    }, 60000) as number;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.tail.then(operation);
    this.tail = next.catch((error: Error) => {
      const detail = reminderFailure(error as BusinessError);
      AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, `同步失败：${detail}；应用运行时自动重试`);
      console.warn(`[RefreshReminder] sync failed: ${detail}`);
    });
    return next;
  }

  setEnabled(kind: RefreshReminderKind, enabled: boolean): Promise<void> {
    return this.enqueue(async () => {
      await kvSet(refreshReminderKey(kind), enabled);
      AppStorage.setOrCreate(refreshReminderKey(kind), enabled);
      await this.syncOnce();
    });
  }

  sync(): Promise<void> {
    // Lifecycle callers must not leave rejected promises unhandled.
    return this.enqueue(async () => { await this.syncOnce(); }).catch(() => undefined);
  }

  private async cancel(id: number): Promise<void> {
    try { await calendarReminder.cancelReminder(id); }
    catch (error) {
      const failure = error as BusinessError;
      if (failure.code !== 1700003) throw new Error(`cancelReminder ${id}: ${failure.code} ${failure.message}`);
    }
  }

  private async syncOnce(): Promise<void> {
    const now = Date.now();
    const targets: RefreshReminderTarget[] = [];
    let anyEnabled = false;
    for (const kind of REFRESH_REMINDER_KINDS) {
      const enabled = await kvGetBool(refreshReminderKey(kind), false);
      AppStorage.setOrCreate(refreshReminderKey(kind), enabled);
      if (enabled) {
        anyEnabled = true;
        targets.push(...refreshReminderTargets(kind, now));
      }
    }
    const byGroup = new Map<string, RefreshReminderTarget>();
    targets.forEach(item => byGroup.set(item.groupId, item));
    const kept = new Set<string>();
    const existing = await calendarReminder.getAllValidReminders();
    for (const reminder of existing) {
      const request = reminder.reminderReq;
      const group = request.groupId ?? '';
      if (!group.startsWith(REFRESH_REMINDER_PREFIX)) continue;
      const item = byGroup.get(group);
      if (item && !kept.has(group) && request.content === item.content &&
          request.reminderType === reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR) {
        kept.add(group);
      } else {
        await this.cancel(reminder.reminderId);
      }
    }
    if (targets.length === 0) {
      AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, anyEnabled ?
        '今日演习提醒时间已过；次日运行应用时登记当天提醒' : '已关闭时间点提醒');
      return;
    }
    if (!await calendarReminder.isEnabled()) {
      AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, '日历未授权，请点击“授权日历并登记”');
      return;
    }
    let failures = 0;
    let firstFailure = '';
    for (const item of targets) {
      // Leave due reminders registered until the deadline; do not recreate dismissed notifications.
      if (kept.has(item.groupId) || item.remindAt <= Date.now()) continue;
      const date = new Date(item.remindAt);
      const request: reminderAgentManager.ReminderRequestCalendar = {
        reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
        dateTime: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
          hour: date.getHours(), minute: date.getMinutes(), second: 0 },
        title: item.title, content: item.content, expiredContent: item.content,
        notificationId: item.notificationId, groupId: item.groupId,
        slotType: notificationManager.SlotType.CONTENT_INFORMATION,
        ringDuration: 0, snoozeTimes: 0, tapDismissed: true,
        wantAgent: { pkgName: 'io.github.cesium.kchomo', abilityName: 'EntryAbility' },
      };
      // All refresh reminders are one-shot; omit repeat fields entirely.
      try { await calendarReminder.publishReminder(request); }
      catch (error) {
        failures++;
        const detail = reminderFailure(error as BusinessError);
        if (!firstFailure) firstFailure = detail;
        console.warn(`[RefreshReminder] publish failed kind=${item.kind}, group=${item.groupId}: ${detail}`);
      }
    }
    AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, failures > 0 ?
      `${failures} 项登记失败：${firstFailure}；应用运行时自动重试` : '提醒已登记，新增提醒由系统日历通知');
  }
}

let service: RefreshReminderService | null = null;
export function getRefreshReminderService(): RefreshReminderService {
  if (!service) service = new RefreshReminderService();
  return service;
}
