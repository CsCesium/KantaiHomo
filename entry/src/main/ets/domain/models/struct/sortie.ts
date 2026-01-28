/**
 * Sortie - 出击相关类型
 * 用于跟踪当前出击状态
 * 内存中，不持久化
 */

import type { BattleSegment } from './battle';
import type { FleetSnapshot, BattlePrediction, EnemyFleetInfo, AirBaseSnapshot } from './battle_record';
import type { SortieCell } from './map';

// ==================== 出击上下文 ====================

export type SortieResult = 'ongoing' | 'cleared' | 'retreated' | 'sunk';

export interface SortieContext {
  sortieId: string;           // UUID

  // 地图信息
  mapAreaId: number;
  mapInfoNo: number;

  // 舰队
  deckId: number;
  combinedType: number;       // 0=非联合, 1=CTF, 2=STF, 3=TCF

  // 时间
  startTime: number;

  // 节点历史
  currentCell: SortieCell | null;
  cellHistory: SortieCell[];

  // 当前战斗
  pendingBattle: BattleContext | null;

  // 舰队快照 (出击时)
  fleetSnapshot: FleetSnapshot;
  fleetSnapshotEscort?: FleetSnapshot;

  // 基地航空队快照
  airBases?: AirBaseSnapshot[];

  // 资源消耗追踪
  fuelUsed: number;
  ammoUsed: number;

  // 结果
  result: SortieResult;
  bossReached: boolean;
  bossKilled: boolean;
}

// ==================== 战斗上下文 ====================

export interface BattleContext {
  // 战斗点位
  cell: SortieCell;

  // 战斗数据
  daySegment: BattleSegment | null;
  nightSegment: BattleSegment | null;

  // 合并后的完整战斗
  merged: BattleSegment | null;

  // 敌方信息
  enemyFleet?: EnemyFleetInfo;
  enemyFleetEscort?: EnemyFleetInfo;

  // 预测结果
  prediction: BattlePrediction | null;

  // 战斗类型标记
  isPractice: boolean;
  isCombined: boolean;
  isAirRaid: boolean;

  // 时间
  startedAt: number;
}

// ==================== 出击记录 (持久化) ====================

export interface SortieRecord {
  id: string;

  mapAreaId: number;
  mapInfoNo: number;
  deckId: number;
  combinedType: number;

  // 舰队快照
  fleetSnapshot: FleetSnapshot;
  fleetSnapshotEscort?: FleetSnapshot;

  // 路径
  route: number[];  // cell IDs

  // 结果
  result: SortieResult;
  bossReached: boolean;
  bossKilled: boolean;

  // 资源消耗
  fuelUsed: number;
  ammoUsed: number;

  // 时间
  startedAt: number;
  endedAt?: number;
}

// ==================== 辅助函数 ====================

/** 生成出击ID */
export function generateSortieId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `sortie_${ts}_${rand}`;
}

/** 生成战斗ID */
export function generateBattleId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `battle_${ts}_${rand}`;
}

/** 创建空的出击上下文 */
export function createSortieContext(
  mapAreaId: number,
  mapInfoNo: number,
  deckId: number,
  fleetSnapshot: FleetSnapshot,
  combinedType = 0,
  fleetSnapshotEscort?: FleetSnapshot,
): SortieContext {
  return {
    sortieId: generateSortieId(),
    mapAreaId,
    mapInfoNo,
    deckId,
    combinedType,
    startTime: Date.now(),
    currentCell: null,
    cellHistory: [],
    pendingBattle: null,
    fleetSnapshot,
    fleetSnapshotEscort,
    fuelUsed: 0,
    ammoUsed: 0,
    result: 'ongoing',
    bossReached: false,
    bossKilled: false,
  };
}

export function createBattleContext(cell: SortieCell, isPractice = false, isCombined = false): BattleContext {
  return {
    cell,
    daySegment: null,
    nightSegment: null,
    merged: null,
    prediction: null,
    isPractice,
    isCombined,
    isAirRaid: false,
    startedAt: Date.now(),
  };
}
