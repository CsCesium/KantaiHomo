/**
 * ExpeditionLiveNotificationService
 *
 * 维护远征时间表。使用绝对时间，避免后台冻结后显示过期的剩余时间。
 * - start()   : 立即刷新并开启 30 秒定时器
 * - stop()    : 停止定时器并取消常驻通知
 * - refresh() : 查询 DB → 更新/取消通知，可在外部任意调用
 */

import notificationManager from '@ohos.notificationManager';
import { getRepositoryHub } from '../../../infra/storage/repo';
import { getMissionName } from './missionCache';
import { addOnExpeditionChanged } from './expeditionTrigger';
import { getLaunchWantAgent } from './launchWantAgent';
import { formatExpeditionReturnTime } from './expeditionTime';
// ── 常驻通知 ID ──────────────────────────────────────────────────
const LIVE_NOTIFICATION_ID = 100;

// ── 工具函数 ─────────────────────────────────────────────────────

// ── 服务主体 ─────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

class ExpeditionLiveNotificationService {
  private timer: number | null = null;
  private running: boolean = false;
  private unsubscribeExpeditionChanged: (() => void) | null = null;
  private refreshTail: Promise<void> = Promise.resolve();
  private lastContent: string = '';

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    // Only registers refresh — scheduler poke is registered separately in Entry.ets
    this.unsubscribeExpeditionChanged = addOnExpeditionChanged(() => { void this.refresh(); });
    await this.refresh();
    this.scheduleNextRefresh();
    console.info('[ExpeditionLiveNotification] started');
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.unsubscribeExpeditionChanged !== null) {
      this.unsubscribeExpeditionChanged();
      this.unsubscribeExpeditionChanged = null;
    }
    // A publish already in flight must finish before cancellation.
    this.refreshTail = this.refreshTail.then(() => this._cancel());
    console.info('[ExpeditionLiveNotification] stopped');
  }

  private scheduleNextRefresh(): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.refresh();
      this.scheduleNextRefresh();
    }, REFRESH_INTERVAL_MS) as number;
  }

  // ── 核心刷新 ──

  refresh(force: boolean = false): Promise<void> {
    this.refreshTail = this.refreshTail.catch(() => undefined).then(() => {
      if (force) this.lastContent = '';
      return this.refreshOnce();
    });
    return this.refreshTail;
  }

  private async refreshOnce(): Promise<void> {
    if (!this.running) return;
    try {
      if (!await notificationManager.isNotificationEnabled()) {
        this.lastContent = '';
        return;
      }
      const hub = getRepositoryHub();

      // 从 expeditions 表取进行中的远征（progress = 1 = RUNNING）
      const expeditions = await hub.expedition.list();
      const decks = await hub.deck.list();

      const deckNameMap = new Map<number, string>(decks.map(d => [d.deckId, d.name]));
      const now = Date.now();

      const active = expeditions.filter(e => e.progress === 1 && e.returnTime > 0);

      if (active.length === 0) {
        await this._cancel();
        return;
      }

      // 按返回时间升序排列
      active.sort((a, b) => a.returnTime - b.returnTime);

      // 构建活跃远征 Map，供 lines 查找
      const activeMap = new Map(active.map(e => [e.deckId, e]));

      // Include active fleets even while the deck name snapshot is still loading.
      for (const exp of active) {
        if (!deckNameMap.has(exp.deckId)) deckNameMap.set(exp.deckId, `第${exp.deckId}舰队`);
      }
      const lines: string[] = [];
      const deckIds = Array.from(deckNameMap.keys()).filter(id => id !== 1).sort((a, b) => a - b);
      for (const deckId of deckIds) {
        const name = deckNameMap.get(deckId) ?? `第${deckId}舰队`;
        const exp = activeMap.get(deckId);
        if (exp) {
          const missionName = getMissionName(exp.missionId);
          lines.push(`${name}: ${missionName}  预计 ${formatExpeditionReturnTime(exp.returnTime)} 归来`);
        } else {
          lines.push(`${name}: 空闲中`);
        }
      }

      const upcoming = active.filter(exp => exp.returnTime > now);
      const briefText = `${upcoming.length} 支远征中 / ${active.length - upcoming.length} 支已到归来时间`;
      const earliest = upcoming[0] ?? active[0];
      const earliestDeckName = deckNameMap.get(earliest.deckId) ?? `第${earliest.deckId}舰队`;
      const earliestMissionName = getMissionName(earliest.missionId);
      const summaryText = `预计归来：${earliestDeckName}「${earliestMissionName}」 ${formatExpeditionReturnTime(earliest.returnTime)}`;

      const contentKey = `${briefText}\n${summaryText}\n${lines.join('\n')}`;
      if (contentKey === this.lastContent) return;

      const agent = await getLaunchWantAgent();
      if (!this.running) return;

      await notificationManager.publish({
        id: LIVE_NOTIFICATION_ID,
        notificationSlotType: notificationManager.SlotType.OTHER_TYPES,
        isOngoing: true,
        isUnremovable: false,
        tapDismissed: false,
        wantAgent: agent ?? undefined,
        content: {
          notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_MULTILINE,
          multiLine: {
            title: '舰队远征时间表',
            text: summaryText,
            briefText,
            longTitle: summaryText,
            lines,
          },
        },
      });

      this.lastContent = contentKey;
      console.debug(`[ExpeditionLiveNotification] published, fleets=${active.length}`);
    } catch (e) {
      console.warn('[ExpeditionLiveNotification] refresh failed:', e);
    }
  }

  // ── 取消通知 ──

  private async _cancel(): Promise<void> {
    this.lastContent = '';
    try {
      await notificationManager.cancel(LIVE_NOTIFICATION_ID);
      console.debug('[ExpeditionLiveNotification] cancelled');
    } catch (_) {
      // 通知不存在时忽略错误
    }
  }
}

// ── 单例 ─────────────────────────────────────────────────────────

let _service: ExpeditionLiveNotificationService | null = null;

export function getExpeditionLiveNotificationService(): ExpeditionLiveNotificationService {
  if (!_service) {
    _service = new ExpeditionLiveNotificationService();
  }
  return _service;
}
