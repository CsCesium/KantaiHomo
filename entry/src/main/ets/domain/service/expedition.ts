/**
 * Expedition Service - 处理远征相关业务逻辑
 */

import { getRepositoryHub } from '../../infra/storage/repo';
import {
  MissionStart,
  MissionResult,
  ExpeditionSlotState,
  ExpeditionProgress
} from '../models/struct/expedition';

/**
 * 保存远征开始信息
 */
export async function saveExpeditionStart(start: MissionStart): Promise<void> {
  const hub = getRepositoryHub();

  // 更新 deck 的远征状态
  const deck = await hub.deck.get(start.deckId);
  if (deck) {
    await hub.deck.upsertBatch([{
      ...deck,
      expeditionProgress: ExpeditionProgress.RUNNING,
      expeditionMissionId: start.missionId,
      expeditionReturnTime: start.complTime,
      expeditionUpdatedAt: start.updatedAt,
      updatedAt: start.updatedAt,
    }]);
  }
}

/**
 * 保存远征结果
 */
export async function saveExpeditionResult(result: MissionResult): Promise<void> {
  const hub = getRepositoryHub();

  // 更新 deck 的远征状态为 IDLE
  const deck = await hub.deck.get(result.deckId);
  if (deck) {
    await hub.deck.upsertBatch([{
      ...deck,
      expeditionProgress: ExpeditionProgress.IDLE,
      expeditionMissionId: 0,
      expeditionReturnTime: 0,
      expeditionUpdatedAt: result.finishedAt,
      updatedAt: result.finishedAt,
    }]);
  }

  // TODO: 保存远征结果到 expedition_results 表
}

/**
 * 获取下一个即将返回的远征
 */
export async function getNextExpeditionReturn(
  nowMs: number = Date.now()
): Promise<ExpeditionSlotState | null> {
  const hub = getRepositoryHub();
  const next = await hub.expedition.getNextAfter(nowMs);

  if (!next) return null;

  return {
    deckId: next.deckId,
    progress: ExpeditionProgress.RUNNING,
    missionId: next.missionId,
    returnTime: next.returnTime,
    updatedAt: nowMs,
  };
}

/**
 * 获取所有远征中的舰队状态
 */
export async function getActiveExpeditions(): Promise<ExpeditionSlotState[]> {
  const hub = getRepositoryHub();
  const decks = await hub.deck.list();

  return decks
    .filter(d => d.expeditionProgress === ExpeditionProgress.RUNNING)
    .map(d => ({
      deckId: d.deckId,
      progress: d.expeditionProgress as ExpeditionProgress,
      missionId: d.expeditionMissionId,
      returnTime: d.expeditionReturnTime,
      updatedAt: d.expeditionUpdatedAt,
    }));
}

/**
 * 检查是否有远征即将返回
 * @param thresholdMs 提前提醒的时间（毫秒），默认 60 秒
 */
export async function checkExpeditionsDue(
  nowMs: number = Date.now(),
  thresholdMs: number = 60000
): Promise<ExpeditionSlotState[]> {
  const active = await getActiveExpeditions();
  const deadline = nowMs + thresholdMs;

  return active.filter(e => e.returnTime > 0 && e.returnTime <= deadline);
}

/**
 * 计算远征剩余时间
 */
export function getExpeditionRemainingTime(returnTime: number, nowMs: number = Date.now()): number {
  return Math.max(0, returnTime - nowMs);
}

/**
 * 格式化远征剩余时间
 */
export function formatRemainingTime(remainingMs: number): string {
  if (remainingMs <= 0) return '已返回';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
