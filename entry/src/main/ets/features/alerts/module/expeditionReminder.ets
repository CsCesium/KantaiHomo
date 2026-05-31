/**
 * System-backed expedition reminders.
 *
 * ArkTS timers are suspended when the app goes to background. ReminderAgent
 * keeps the due-time notification owned by the system so expedition returns
 * still notify after the process is paused or killed.
 */

import notificationManager from '@ohos.notificationManager';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { getRepositoryHub } from '../../../infra/storage/repo';
import { getMissionName } from './missionCache';
import { addOnExpeditionChanged } from './expeditionTrigger';

const BUNDLE_NAME = 'io.github.cesium.kchomo';
const ENTRY_ABILITY_NAME = 'EntryAbility';
const GROUP_PREFIX = 'kchomo.expedition.';
const NOTIFICATION_ID_EXPEDITION_BASE = 1000;

interface ExpeditionReminderTarget {
  deckId: number;
  missionId: number;
  returnTime: number;
  groupId: string;
}

interface ExistingReminder {
  reminderId: number;
  deckId: number;
  groupId: string;
}

function reminderGroupId(deckId: number, missionId: number, returnTime: number): string {
  return `${GROUP_PREFIX}${deckId}.${missionId}.${returnTime}`;
}

function notificationIdForDeck(deckId: number): number {
  return NOTIFICATION_ID_EXPEDITION_BASE + deckId;
}

function deckIdFromNotificationId(notificationId?: number): number | null {
  if (notificationId === undefined || notificationId === null) return null;
  const deckId = notificationId - NOTIFICATION_ID_EXPEDITION_BASE;
  return deckId >= 2 && deckId <= 4 ? deckId : null;
}

async function cancelReminder(reminderId: number): Promise<void> {
  try {
    await reminderAgentManager.cancelReminder(reminderId);
  } catch (e) {
    console.warn(`[ExpeditionReminder] cancel failed id=${reminderId}:`, e);
  }
}

class ExpeditionReminderService {
  private running: boolean = false;
  private unsubscribeExpeditionChanged: (() => void) | null = null;
  private syncTail: Promise<void> = Promise.resolve();

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.unsubscribeExpeditionChanged = addOnExpeditionChanged(() => { void this.syncFromDb(); });
    await this.syncFromDb();
    console.info('[ExpeditionReminder] started');
  }

  stop(): void {
    this.running = false;
    if (this.unsubscribeExpeditionChanged !== null) {
      this.unsubscribeExpeditionChanged();
      this.unsubscribeExpeditionChanged = null;
    }
    console.info('[ExpeditionReminder] stopped');
  }

  syncFromDb(): Promise<void> {
    this.syncTail = this.syncTail
      .catch(() => undefined)
      .then(() => this.syncOnce());
    return this.syncTail;
  }

  private async syncOnce(): Promise<void> {
    try {
      const targets = await this.loadTargets();
      const existing = await this.loadExistingReminders();
      await this.cancelStaleReminders(targets, existing);
      await this.publishMissingReminders(targets, existing);
    } catch (e) {
      console.warn('[ExpeditionReminder] sync failed:', e);
    }
  }

  private async loadTargets(): Promise<Map<number, ExpeditionReminderTarget>> {
    const now = Date.now();
    const expeditions = await getRepositoryHub().expedition.list();
    const targets = new Map<number, ExpeditionReminderTarget>();

    for (const exp of expeditions) {
      if (exp.progress !== 1 || exp.returnTime <= now) continue;
      const deckId = exp.deckId;
      if (deckId < 2 || deckId > 4) continue;
      targets.set(deckId, {
        deckId,
        missionId: exp.missionId,
        returnTime: exp.returnTime,
        groupId: reminderGroupId(deckId, exp.missionId, exp.returnTime),
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

      const deckId = deckIdFromNotificationId(req.notificationId);
      if (deckId === null) {
        await cancelReminder(info.reminderId);
        continue;
      }

      const items = map.get(deckId) ?? [];
      items.push({ reminderId: info.reminderId, deckId, groupId });
      map.set(deckId, items);
    }

    return map;
  }

  private async cancelStaleReminders(
    targets: Map<number, ExpeditionReminderTarget>,
    existing: Map<number, ExistingReminder[]>
  ): Promise<void> {
    for (const entry of existing.entries()) {
      const deckId = entry[0];
      const reminders = entry[1];
      const target = targets.get(deckId);
      let kept = false;

      for (const reminder of reminders) {
        if (target && reminder.groupId === target.groupId && !kept) {
          kept = true;
          continue;
        }
        await cancelReminder(reminder.reminderId);
      }
    }
  }

  private async publishMissingReminders(
    targets: Map<number, ExpeditionReminderTarget>,
    existing: Map<number, ExistingReminder[]>
  ): Promise<void> {
    const now = Date.now();

    for (const target of targets.values()) {
      const alreadyScheduled = (existing.get(target.deckId) ?? [])
        .some(reminder => reminder.groupId === target.groupId);
      if (alreadyScheduled) continue;

      const missionName = getMissionName(target.missionId);
      const triggerTimeInSeconds = Math.max(1, Math.ceil((target.returnTime - now) / 1000));
      const returnTimeText = new Date(target.returnTime).toLocaleTimeString();
      const body = `第 ${target.deckId} 舰队「${missionName}」已返回`;

      const request: reminderAgentManager.ReminderRequestTimer = {
        reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_TIMER,
        triggerTimeInSeconds,
        title: '远征归来',
        content: `预计 ${returnTimeText} 返回`,
        expiredContent: body,
        notificationId: notificationIdForDeck(target.deckId),
        groupId: target.groupId,
        slotType: notificationManager.SlotType.SERVICE_INFORMATION,
        tapDismissed: true,
        wantAgent: {
          pkgName: BUNDLE_NAME,
          abilityName: ENTRY_ABILITY_NAME,
        },
      };

      try {
        const reminderId = await reminderAgentManager.publishReminder(request);
        console.info(`[ExpeditionReminder] scheduled deck=${target.deckId}, mission=${target.missionId}, id=${reminderId}`);
      } catch (e) {
        console.warn(`[ExpeditionReminder] publish failed deck=${target.deckId}:`, e);
      }
    }
  }
}

let _service: ExpeditionReminderService | null = null;

export function getExpeditionReminderService(): ExpeditionReminderService {
  if (!_service) {
    _service = new ExpeditionReminderService();
  }
  return _service;
}
