/** System-owned one-shot reminders, scheduled at the expedition's return time. */
import notificationManager from '@ohos.notificationManager';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { getRepositoryHub } from '../../../infra/storage/repo';
import { kvGetBool, kvSet } from '../../../infra/storage/kv';
import { getMissionName } from './missionCache';
import { addOnExpeditionChanged } from './expeditionTrigger';
import { formatExpeditionReturnTime } from './expeditionTime';

export const APP_STORAGE_EXPEDITION_REMINDER_ENABLED = 'alerts.expedition.system.enabled';
export const APP_STORAGE_EXPEDITION_REMINDER_STATUS = 'alerts.expedition.system.status';

const GROUP_PREFIX = 'kchomo.expedition.';
const NOTIFICATION_ID_EXPEDITION_BASE = 1000;
const RETRY_INTERVAL_MS = 30_000;

interface ExpeditionReminderTarget {
  deckId: number;
  missionId: number;
  returnTime: number;
  groupId: string;
}

interface ExistingReminder {
  reminderId: number;
  groupId: string;
  reminderType: reminderAgentManager.ReminderType;
}

function reminderGroupId(deckId: number, missionId: number, returnTime: number): string {
  return `${GROUP_PREFIX}${deckId}.${missionId}.${returnTime}`;
}

async function cancelReminder(reminderId: number): Promise<void> {
  try {
    await reminderAgentManager.cancelReminder(reminderId);
  } catch (e) {
    // Already dismissed by the user; all other failures must be retried.
    const error = e as BusinessError;
    if (error.code !== 1700003) throw new Error(`cancelReminder ${reminderId}: ${error.code} ${error.message}`);
  }
}

class ExpeditionReminderService {
  private running: boolean = false;
  private timer: number | null = null;
  private unsubscribeExpeditionChanged: (() => void) | null = null;
  private syncTail: Promise<void> = Promise.resolve();
  // Keep ownership through the due time, even if the system removes an expired reminder.
  private delegated: Map<number, string> = new Map();

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    AppStorage.setOrCreate(APP_STORAGE_EXPEDITION_REMINDER_ENABLED, true);
    this.setStatus('正在检查系统提醒');
    this.unsubscribeExpeditionChanged = addOnExpeditionChanged(() => { void this.syncFromDb(); });
    await this.syncFromDb();
    this.scheduleRetry();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.unsubscribeExpeditionChanged?.();
    this.unsubscribeExpeditionChanged = null;
    // Do not cancel system reminders when the window or process exits.
  }

  private scheduleRetry(): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.syncFromDb();
      this.scheduleRetry();
    }, RETRY_INTERVAL_MS) as number;
  }

  setEnabled(enabled: boolean): Promise<void> {
    this.syncTail = this.syncTail.catch(() => undefined).then(async () => {
      await kvSet(APP_STORAGE_EXPEDITION_REMINDER_ENABLED, enabled);
      AppStorage.setOrCreate(APP_STORAGE_EXPEDITION_REMINDER_ENABLED, enabled);
      await this.syncOnce();
    });
    return this.syncTail;
  }

  syncFromDb(): Promise<void> {
    this.syncTail = this.syncTail.catch(() => undefined).then(async () => {
      if (this.running) await this.syncOnce();
    });
    return this.syncTail;
  }

  hasSystemReminder(deckId: number, missionId: number, returnTime: number): boolean {
    return this.delegated.get(deckId) === reminderGroupId(deckId, missionId, returnTime);
  }

  private setStatus(text: string): void {
    AppStorage.setOrCreate(APP_STORAGE_EXPEDITION_REMINDER_STATUS, text);
  }

  private async syncOnce(): Promise<void> {
    try {
      const enabled = await kvGetBool(APP_STORAGE_EXPEDITION_REMINDER_ENABLED, true);
      AppStorage.setOrCreate(APP_STORAGE_EXPEDITION_REMINDER_ENABLED, enabled);
      const targets = enabled ? await this.loadTargets() : new Map<number, ExpeditionReminderTarget>();
      for (const entry of this.delegated.entries()) {
        if (targets.get(entry[0])?.groupId !== entry[1]) this.delegated.delete(entry[0]);
      }
      const existing = await this.loadExistingReminders();
      const kept = await this.cancelStaleReminders(targets, existing);
      if (!enabled) {
        this.setStatus('已关闭，已撤销后台归来提醒');
        return;
      }
      if (!await notificationManager.isNotificationEnabled()) {
        this.delegated.clear();
        this.setStatus('未开启系统通知，请允许通知后重试');
        return;
      }
      const failures = await this.publishMissingReminders(targets, kept);
      const pending = Array.from(targets.values()).filter(target => target.returnTime > Date.now());
      const scheduled = pending.filter(target => this.delegated.get(target.deckId) === target.groupId).length;
      if (failures > 0) {
        this.setStatus(`已登记 ${scheduled} 支舰队，${failures} 项失败；应用运行时自动重试`);
      } else {
        this.setStatus(scheduled > 0 ? `已登记 ${scheduled} 支舰队，关闭应用后由系统提醒` : '暂无待登记的远征');
      }
    } catch (e) {
      this.setStatus('系统提醒同步失败，应用运行时自动重试');
      console.warn('[ExpeditionReminder] sync failed:', e);
    }
  }

  private async loadTargets(): Promise<Map<number, ExpeditionReminderTarget>> {
    const expeditions = await getRepositoryHub().expedition.list();
    const targets = new Map<number, ExpeditionReminderTarget>();
    for (const exp of expeditions) {
      // Filtering returnTime <= now can cancel a due reminder before the system displays it.
      if (exp.progress !== 1 || !Number.isFinite(exp.returnTime) || exp.returnTime <= 0) continue;
      if (exp.deckId < 2 || exp.deckId > 4) continue;
      targets.set(exp.deckId, {
        deckId: exp.deckId, missionId: exp.missionId, returnTime: exp.returnTime,
        groupId: reminderGroupId(exp.deckId, exp.missionId, exp.returnTime),
      });
    }
    return targets;
  }

  private async loadExistingReminders(): Promise<Map<number, ExistingReminder[]>> {
    const map = new Map<number, ExistingReminder[]>();
    const reminders = await reminderAgentManager.getAllValidReminders();
    for (const info of reminders) {
      const req = info.reminderReq;
      const groupId = req.groupId ?? '';
      if (!groupId.startsWith(GROUP_PREFIX)) continue;
      const deckId = (req.notificationId ?? 0) - NOTIFICATION_ID_EXPEDITION_BASE;
      if (deckId < 2 || deckId > 4) {
        await cancelReminder(info.reminderId);
        continue;
      }
      const items = map.get(deckId) ?? [];
      items.push({ reminderId: info.reminderId, groupId, reminderType: req.reminderType });
      map.set(deckId, items);
    }
    return map;
  }

  private async cancelStaleReminders(
    targets: Map<number, ExpeditionReminderTarget>,
    existing: Map<number, ExistingReminder[]>
  ): Promise<Map<number, ExistingReminder>> {
    const kept = new Map<number, ExistingReminder>();
    for (const entry of existing.entries()) {
      const deckId = entry[0];
      const target = targets.get(deckId);
      for (const reminder of entry[1]) {
        // Migrate future legacy timers to absolute calendar reminders. Leave due ones alone.
        const suitableType = reminder.reminderType === reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR ||
          (target !== undefined && target.returnTime <= Date.now());
        if (target && reminder.groupId === target.groupId && suitableType && !kept.has(deckId)) {
          kept.set(deckId, reminder);
          this.delegated.set(deckId, target.groupId);
        } else {
          await cancelReminder(reminder.reminderId);
        }
      }
    }
    return kept;
  }

  private async publishMissingReminders(
    targets: Map<number, ExpeditionReminderTarget>,
    kept: Map<number, ExistingReminder>
  ): Promise<number> {
    let failures = 0;
    for (const target of targets.values()) {
      if (kept.has(target.deckId) || target.returnTime <= Date.now()) continue;
      this.delegated.delete(target.deckId);
      const date = new Date(Math.ceil(target.returnTime / 1000) * 1000);
      const body = `第 ${target.deckId} 舰队「${getMissionName(target.missionId)}」已到归来时间（${formatExpeditionReturnTime(target.returnTime)}）`;
      const request: reminderAgentManager.ReminderRequestCalendar = {
        reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
        dateTime: {
          year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
          hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(),
        },
        title: '远征归来',
        content: body,
        expiredContent: body,
        notificationId: NOTIFICATION_ID_EXPEDITION_BASE + target.deckId,
        groupId: target.groupId,
        slotType: notificationManager.SlotType.SERVICE_INFORMATION,
        tapDismissed: true,
        ringDuration: 1,
        ringChannel: reminderAgentManager.RingChannel.RING_CHANNEL_NOTIFICATION,
        snoozeTimes: 0,
        actionButton: [{ title: '关闭', type: reminderAgentManager.ActionButtonType.ACTION_BUTTON_TYPE_CLOSE }],
        wantAgent: { pkgName: 'io.github.cesium.kchomo', abilityName: 'EntryAbility' },
      };
      try {
        const reminderId = await reminderAgentManager.publishReminder(request);
        this.delegated.set(target.deckId, target.groupId);
        console.info(`[ExpeditionReminder] scheduled deck=${target.deckId}, id=${reminderId}, returnTime=${target.returnTime}`);
      } catch (e) {
        failures++;
        console.warn(`[ExpeditionReminder] publish failed deck=${target.deckId}:`, e);
      }
    }
    return failures;
  }
}

let _service: ExpeditionReminderService | null = null;

export function getExpeditionReminderService(): ExpeditionReminderService {
  if (!_service) _service = new ExpeditionReminderService();
  return _service;
}
