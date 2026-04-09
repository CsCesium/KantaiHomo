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
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

      // 构建活跃远征 Map，供 lines 查找
      const activeMap = new Map(active.map(e => [e.deckId, e]));

      // 所有舰队按 deckId 排序：远征中显示任务+倒计时，空闲显示"空闲中"
      const lines: string[] = decks
        .slice()
        .sort((a, b) => a.deckId - b.deckId)
        .map(d => {
          const exp = activeMap.get(d.deckId);
          if (exp) {
            const missionName = getMissionName(exp.missionId);
            const countdown = formatCountdown(exp.returnTime - now);
            return `${d.name}: ${missionName}  ${countdown}`;
          }
          return `${d.name}: 空闲中`;
        });

      const briefText = `${active.length} 支舰队远征中`;
      const earliest = active[0];
      const earliestCountdown = formatCountdown(earliest.returnTime - now);
      const earliestDeckName = deckNameMap.get(earliest.deckId) ?? `第${earliest.deckId}舰队`;
      const earliestMissionName = getMissionName(earliest.missionId);

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
            longTitle: `最快返回：${earliestDeckName} 「${earliestMissionName}」 ${earliestCountdown}`,
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
