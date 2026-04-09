/**
 * ExpeditionLiveNotificationService
 *
 * 维护常驻通知栏，显示所有正在执行的远征及倒计时。
 * - start()   : 立即刷新并开启每分钟定时器
 * - stop()    : 停止定时器并取消常驻通知
 * - refresh() : 查询 DB → 更新/取消通知，可在外部任意调用
 */

import notificationManager from '@ohos.notificationManager';
import { getRepositoryHub } from '../../../infra/storage/repo';
import { getMissionName } from './missionCache';
import { addOnExpeditionChanged } from './expeditionTrigger';

// ── 常驻通知 ID ──────────────────────────────────────────────────
const LIVE_NOTIFICATION_ID = 100;

// ── 工具函数 ─────────────────────────────────────────────────────

function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '待归来';
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── 服务主体 ─────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000; // 每分钟刷新

class ExpeditionLiveNotificationService {
  private timer: number | null = null;

  async start(): Promise<void> {
    if (this.timer !== null) return;
    // Only registers refresh — scheduler poke is registered separately in Entry.ets
    addOnExpeditionChanged(() => { void this.refresh(); });
    await this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS) as number;
    console.info('[ExpeditionLiveNotification] started');
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    void this._cancel();
    console.info('[ExpeditionLiveNotification] stopped');
  }

  // ── 核心刷新 ──

  async refresh(): Promise<void> {
    try {
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

      const lines: string[] = active.map(e => {
        const deckName = deckNameMap.get(e.deckId) ?? `第${e.deckId}舰队`;
        const missionName = getMissionName(e.missionId);
        const countdown = formatCountdown(e.returnTime - now);
        return `${deckName}: ${missionName}  ${countdown}`;
      });

      const briefText = `${active.length} 支舰队远征中`;
      const earliestCountdown = formatCountdown(active[0].returnTime - now);

      await notificationManager.publish({
        id: LIVE_NOTIFICATION_ID,
        notificationSlotType: notificationManager.SlotType.OTHER_TYPES,
        isOngoing: true,
        isUnremovable: false,
        content: {
          notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_MULTILINE,
          multiLine: {
            title: '舰队远征倒计时',
            text: briefText,
            briefText,
            longTitle: `最快返回: ${earliestCountdown}`,
            lines,
          },
        },
      });

      console.debug(`[ExpeditionLiveNotification] published, fleets=${active.length}`);
    } catch (e) {
      console.warn('[ExpeditionLiveNotification] refresh failed:', e);
    }
  }

  // ── 取消通知 ──

  private async _cancel(): Promise<void> {
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
