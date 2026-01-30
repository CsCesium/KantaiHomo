/**
 * Battle Events - 战斗相关事件
 *
 * 1. Parser 产出事件 ( API) -  PayloadEvent 形式
 * 2. Handler 发布事件 ( UI) -  interface 形式
 */

import type { PayloadEvent } from './type';
import type { BattleSegment } from '../models/struct/battle';
import type { BattlePrediction, BattleRecord, FleetSnapshot } from '../models/struct/battle_record';
import type { SortieCell } from '../models/struct/map';
import { NormalizedBattleResult, SortieContext, SortieResult } from '../models';

// ============================================================
// Parser 产出事件 (来自 API 响应，与 Port 模式一致)
// ============================================================

// -------------------- Sortie Events --------------------

/** 出击开始 payload */
export interface SortieStartPayload {
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  deckId: number;
  combinedType: number;
  fleetSnapshot: FleetSnapshot;
  fleetSnapshotEscort?: FleetSnapshot;
}

/** 出击下一节点 payload */
export interface SortieNextPayload {
  cell: SortieCell;
}

/** Parser ：出击开始 */
export type SortieStartEvent = PayloadEvent<'SORTIE_START', SortieStartPayload>;

/** Parser ：移动到下一节点 */
export type SortieNextEvent = PayloadEvent<'SORTIE_NEXT', SortieNextPayload>;

// -------------------- Battle Events --------------------

/** 昼战 payload */
export interface BattleDayPayload {
  apiPath: string;
  segment: BattleSegment;
  prediction: BattlePrediction;
  isPractice: boolean;
}

/** 夜战 payload */
export interface BattleNightPayload {
  apiPath: string;
  segment: BattleSegment;
  prediction: BattlePrediction;
  isPractice: boolean;
}

/** 战斗结果 payload */
export interface BattleResultPayload {
  apiPath: string;
  isPractice: boolean;
  result: NormalizedBattleResult;
}

/** Parser 事件：昼战 */
export type BattleDayEvent = PayloadEvent<'BATTLE_DAY', BattleDayPayload>;

/** Parser 事件：夜战 */
export type BattleNightEvent = PayloadEvent<'BATTLE_NIGHT', BattleNightPayload>;

/** Parser 事件：战斗结果 */
export type BattleResultEvent = PayloadEvent<'BATTLE_RESULT', BattleResultPayload>;

// -------------------- Parser 事件联合类型 --------------------

export type AnySortieEvt = SortieStartEvent | SortieNextEvent;

export type AnyBattleEvt = BattleDayEvent | BattleNightEvent | BattleResultEvent;

export type AnyBattleModuleEvt = AnySortieEvt | AnyBattleEvt;

// ============================================================
// Handler 发布事件 (给 UI/其他模块订阅)
// ============================================================

/** 出击开始通知 */
export interface SortieStartedNotification {
  type: 'sortie:started';
  context: SortieContext;
}

/** 移动到新点位通知 */
export interface SortieCellMovedNotification {
  type: 'sortie:cell_moved';
  cell: SortieCell;
  cellIndex: number;
}

/** 出击结束通知 */
export interface SortieEndedNotification {
  type: 'sortie:ended';
  context: SortieContext;
  result: SortieResult;
}

/** 战斗预测通知 */
export interface BattlePredictedNotification {
  type: 'battle:predicted';
  prediction: BattlePrediction;
  apiPath: string;
  kind: 'day' | 'night';
  hasTaiha: boolean;
  taihaShips: Array<{ uid: number; name: string; hpPercent: number; position: number }>;
}

/** 战斗结束通知 */
export interface BattleEndedNotification {
  type: 'battle:ended';
  record: BattleRecord;
}

/** 大破警告通知 */
export interface TaihaWarningNotification {
  type: 'battle:taiha_warning';
  ships: Array<{
    uid: number;
    name: string;
    hpPercent: number;
    position: number;
  }>;
}

/** Boss 到达通知 */
export interface BossReachedNotification {
  type: 'sortie:boss_reached';
  cell: SortieCell;
}

// -------------------- UI 通知联合类型 --------------------

export type SortieNotification =
  | SortieStartedNotification
    | SortieCellMovedNotification
    | SortieEndedNotification
    | BossReachedNotification;

export type BattleNotification =
  | BattlePredictedNotification
    | BattleEndedNotification
    | TaihaWarningNotification;

export type BattleModuleNotification = SortieNotification | BattleNotification;

// ============================================================
// 事件创建辅助函数
// ============================================================

export function createSortieStartedEvent(context: SortieContext): SortieStartedNotification {
  return { type: 'sortie:started', context };
}

export function createSortieCellMovedEvent(cell: SortieCell, cellIndex: number): SortieCellMovedNotification {
  return { type: 'sortie:cell_moved', cell, cellIndex };
}

export function createSortieEndedEvent(context: SortieContext, result: SortieResult): SortieEndedNotification {
  return { type: 'sortie:ended', context, result };
}

export function createBattlePredictedEvent(
  prediction: BattlePrediction,
  apiPath: string,
  kind: 'day' | 'night',
  hasTaiha: boolean,
  taihaShips: Array<{ uid: number; name: string; hpPercent: number; position: number }>
): BattlePredictedNotification {
  return { type: 'battle:predicted', prediction, apiPath, kind, hasTaiha, taihaShips };
}

export function createBattleEndedEvent(record: BattleRecord): BattleEndedNotification {
  return { type: 'battle:ended', record };
}

export function createTaihaWarningEvent(
  ships: Array<{ uid: number; name: string; hpPercent: number; position: number }>
): TaihaWarningNotification {
  return { type: 'battle:taiha_warning', ships };
}

export function createBossReachedEvent(cell: SortieCell): BossReachedNotification {
  return { type: 'sortie:boss_reached', cell };
}
