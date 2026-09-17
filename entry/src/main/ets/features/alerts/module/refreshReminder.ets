import notificationManager from '@ohos.notificationManager';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { kvGetBool, kvSet } from '../../../infra/storage/kv';
import {
  REFRESH_REMINDER_KINDS, REFRESH_REMINDER_PREFIX, REFRESH_REMINDER_STATUS,
  RefreshReminderKind, RefreshReminderTarget, refreshReminderKey, refreshReminderTargets,
} from './refreshSchedule';

/** Notification-only deadlines, independent of AlertBus's toast/vibration preferences. */
class RefreshReminderService {
  private running: boolean = false;
  private timer: number | null = null;
  private tail: Promise<void> = Promise.resolve();
  private slotReady: boolean = false;

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
      AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, '同步失败，应用运行时自动重试');
      console.warn('[RefreshReminder]', String(error));
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
    try { await reminderAgentManager.cancelReminder(id); }
    catch (error) {
      if ((error as BusinessError).code !== 1700003) throw error;
    }
  }

  private async syncOnce(): Promise<void> {
    const now = Date.now();
    const targets: RefreshReminderTarget[] = [];
    for (const kind of REFRESH_REMINDER_KINDS) {
      const enabled = await kvGetBool(refreshReminderKey(kind), false);
      AppStorage.setOrCreate(refreshReminderKey(kind), enabled);
      if (enabled) targets.push(...refreshReminderTargets(kind, now));
    }
    const byGroup = new Map<string, RefreshReminderTarget>();
    targets.forEach(item => byGroup.set(item.groupId, item));
    const kept = new Set<string>();
    const existing = await reminderAgentManager.getAllValidReminders();
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
      AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, '已关闭时间点提醒');
      return;
    }
    if (!await notificationManager.isNotificationEnabled()) {
      AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, '未获得通知权限，请检查并重试');
      return;
    }
    if (!this.slotReady) {
      // Separate from expedition/service notifications; never change their vibration settings.
      await reminderAgentManager.addNotificationSlot({
        notificationType: notificationManager.SlotType.CONTENT_INFORMATION,
        vibrationEnabled: false,
      });
      this.slotReady = true;
    }
    let failures = 0;
    for (const item of targets) {
      // Leave due reminders registered until the deadline; do not recreate dismissed notifications.
      if (kept.has(item.groupId) || item.remindAt <= Date.now()) continue;
      const date = new Date(item.remindAt);
      const request: reminderAgentManager.ReminderRequestCalendar = {
        reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
        dateTime: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
          hour: date.getHours(), minute: date.getMinutes(), second: 0 },
        daysOfWeek: item.daily ? [1, 2, 3, 4, 5, 6, 7] : undefined,
        title: item.title, content: item.content, expiredContent: item.content,
        notificationId: item.notificationId, groupId: item.groupId,
        slotType: notificationManager.SlotType.CONTENT_INFORMATION,
        ringDuration: 0, snoozeTimes: 0, tapDismissed: true,
        wantAgent: { pkgName: 'io.github.cesium.kchomo', abilityName: 'EntryAbility' },
      };
      try { await reminderAgentManager.publishReminder(request); }
      catch (error) { failures++; console.warn('[RefreshReminder] publish failed:', error); }
    }
    AppStorage.setOrCreate(REFRESH_REMINDER_STATUS, failures > 0 ?
      `${failures} 项登记失败，应用运行时自动重试` : '系统提醒已登记，关闭应用后仍可通知');
  }
}

let service: RefreshReminderService | null = null;
export function getRefreshReminderService(): RefreshReminderService {
  if (!service) service = new RefreshReminderService();
  return service;
}
