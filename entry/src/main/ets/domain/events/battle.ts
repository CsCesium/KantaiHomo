/**
 * Battle Events - 战斗相关事件
 */

import type { BattlePrediction, BattleRecord } from '../models/struct/battle_record';
import type { SortieCell } from '../models/struct/map';
import type { SortieContext, SortieResult } from '../models/struct/sortie';

// ==================== 出击事件 ====================

/** 出击开始 */
export interface SortieStartedEvent {
  type: 'sortie:started';
  context: SortieContext;
}

/** 移动到新点位 */
export interface SortieCellMovedEvent {
  type: 'sortie:cell_moved';
  cell: SortieCell;
  cellIndex: number;
}

/** 出击结束 */
export interface SortieEndedEvent {
  type: 'sortie:ended';
  context: SortieContext;
  result: SortieResult;
}

// ==================== 战斗事件 ====================

/** 战斗开始 (收到 battle API) */
export interface BattleStartedEvent {
  type: 'battle:started';
  cell: SortieCell;
  apiPath: string;
  isDayBattle: boolean;
  isNightBattle: boolean;
  isPractice: boolean;
}

/** 战斗预测完成 */
export interface BattlePredictedEvent {
  type: 'battle:predicted';
  prediction: BattlePrediction;
}

/** 战斗结束 (收到 battleresult API) */
export interface BattleEndedEvent {
  type: 'battle:ended';
  record: BattleRecord;
}

// ==================== 警告事件 ====================

/** 大破警告 */
export interface TaihaWarningEvent {
  type: 'battle:taiha_warning';
  ships: {
    uid: number;
    name: string;
    hpPercent: number;
    position: number;  // 舰队位置 (0-based)
  }[];
}

/** 击沉警告 (理论上不应该发生) */
export interface SunkWarningEvent {
  type: 'battle:sunk_warning';
  ships: {
    uid: number;
    name: string;
    position: number;
  }[];
}

// ==================== 联合类型 ====================

export type SortieEvent =
  | SortieStartedEvent
    | SortieCellMovedEvent
    | SortieEndedEvent;

export type BattleEvent =
  | BattleStartedEvent
    | BattlePredictedEvent
    | BattleEndedEvent
    | TaihaWarningEvent
    | SunkWarningEvent;

export type BattleModuleEvent = SortieEvent | BattleEvent;

// ==================== 事件创建辅助函数 ====================

export function createSortieStartedEvent(context: SortieContext): SortieStartedEvent {
  return { type: 'sortie:started', context };
}

export function createSortieCellMovedEvent(cell: SortieCell, cellIndex: number): SortieCellMovedEvent {
  return { type: 'sortie:cell_moved', cell, cellIndex };
}

export function createSortieEndedEvent(context: SortieContext, result: SortieResult): SortieEndedEvent {
  return { type: 'sortie:ended', context, result };
}

export function createBattleStartedEvent(
  cell: SortieCell,
  apiPath: string,
  isDayBattle: boolean,
  isNightBattle: boolean,
  isPractice: boolean
): BattleStartedEvent {
  return { type: 'battle:started', cell, apiPath, isDayBattle, isNightBattle, isPractice };
}

export function createBattlePredictedEvent(prediction: BattlePrediction): BattlePredictedEvent {
  return { type: 'battle:predicted', prediction };
}

export function createBattleEndedEvent(record: BattleRecord): BattleEndedEvent {
  return { type: 'battle:ended', record };
}

export function createTaihaWarningEvent(
  ships: { uid: number; name: string; hpPercent: number; position: number }[]
): TaihaWarningEvent {
  return { type: 'battle:taiha_warning', ships };
}
