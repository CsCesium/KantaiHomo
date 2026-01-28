/**
 * Battle Record - 战斗记录 (持久化)
 * 完整记录一场战斗的所有信息
 */

import type { BattleHpSnapshot } from './battle';

// ==================== 快照类型 ====================

/** 装备快照 */
export interface SlotItemSnapshot {
  uid: number;
  masterId: number;
  name: string;
  level: number;
  alv?: number;  // 熟练度
}

/** 舰船快照 */
export interface ShipSnapshot {
  uid: number;
  masterId: number;
  name: string;
  shipType: number;  // stype
  level: number;

  hpNow: number;
  hpMax: number;

  fuel: number;
  ammo: number;
  fuelMax: number;
  ammoMax: number;

  cond: number;

  // 装备
  slots: (SlotItemSnapshot | null)[];  // 主装备槽
  slotEx?: SlotItemSnapshot | null;    // 补强增设

  // 搭载量 (航空舰)
  onslot?: number[];
}

/** 舰队快照 */
export interface FleetSnapshot {
  deckId: number;
  name: string;
  ships: ShipSnapshot[];
  capturedAt: number;
}

/** 敌方舰队信息 */
export interface EnemyFleetInfo {
  shipIds: number[];      // master id (api_ship_ke)
  levels: number[];       // api_ship_lv
  slots?: number[][];     // api_eSlot
  params?: number[][];    // api_eParam [火力, 雷装, 对空, 装甲]

  hpNow: number[];
  hpMax: number[];
}

/** 基地航空队快照 */
export interface AirBaseSquadronSnapshot {
  masterId: number;
  count: number;
  cond?: number;
}

export interface AirBaseSnapshot {
  baseId: number;
  name?: string;
  actionKind: number;  // 1=出击, 2=防空, etc.
  squadrons: AirBaseSquadronSnapshot[];
}

// ==================== 战斗记录 ====================

export type BattleType = 'normal' | 'combined_ctf' | 'combined_stf' | 'combined_tcf' | 'practice' | 'air_raid';

export interface BattleRecord {
  id: string;          // UUID
  sortieId: string;    // 关联出击

  // 点位信息
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  cellEventId: number;
  isBoss: boolean;

  // 战斗类型
  battleType: BattleType;
  isPractice: boolean;

  // 阵型与交战
  friendFormation?: number;
  enemyFormation?: number;
  engagement?: number;

  // 制空状态
  airState?: number;
  touchPlane?: number[];  // [友军触接机, 敌军触接机]

  // 我方舰队 (战斗开始时快照)
  friendFleet: FleetSnapshot;
  friendFleetEscort?: FleetSnapshot;

  // 敌方舰队
  enemyFleet: EnemyFleetInfo;
  enemyFleetEscort?: EnemyFleetInfo;

  // 基地航空队
  airBases?: AirBaseSnapshot[];

  // HP 变化
  hpStart: BattleHpSnapshot;
  hpEnd: BattleHpSnapshot;

  // 战斗结果
  rank: string;           // S/A/B/C/D/E
  mvp?: number;           // 1-based MVP 位置
  mvpCombined?: number;   // 联合第二舰队 MVP

  // 掉落
  dropShipId?: number;
  dropShipName?: string;
  dropItemId?: number;

  // 经验
  baseExp?: number;

  // 时间戳
  startedAt: number;
  endedAt: number;
}

// ==================== 战斗预测 ====================

export interface ShipPrediction {
  uid: number;
  name: string;

  hpBefore: number;
  hpAfter: number;
  hpMax: number;

  damageReceived: number;
  damageTaken: number;    // 承伤比例 (百分比)

  isSunk: boolean;
  isTaiha: boolean;       // 大破 (≤25%)
  isChuuha: boolean;      // 中破 (≤50%)
  isShouha: boolean;      // 小破 (≤75%)
}

export interface BattlePrediction {
  friendMain: ShipPrediction[];
  friendEscort?: ShipPrediction[];

  enemyMain: ShipPrediction[];
  enemyEscort?: ShipPrediction[];

  // 预测胜负等级
  predictedRank: string;

  // 友军状态统计
  friendSunkCount: number;
  friendTaihaCount: number;

  // 敌军状态统计
  enemySunkCount: number;

  // 危险标记
  hasTaihaFriend: boolean;    // 有大破舰
  hasSunkFriend: boolean;     // 有击沉舰

  calculatedAt: number;
}

// ==================== 辅助函数 ====================

/** 根据 HP 百分比判断损伤状态 */
export function getDamageState(hpNow: number, hpMax: number): 'normal' | 'shouha' | 'chuuha' | 'taiha' | 'sunk' {
  if (hpNow <= 0) return 'sunk';
  const ratio = hpNow / hpMax;
  if (ratio <= 0.25) return 'taiha';
  if (ratio <= 0.5) return 'chuuha';
  if (ratio <= 0.75) return 'shouha';
  return 'normal';
}

/** 是否大破 */
export function isTaiha(hpNow: number, hpMax: number): boolean {
  return hpNow > 0 && (hpNow / hpMax) <= 0.25;
}

/** 是否击沉 */
export function isSunk(hpNow: number): boolean {
  return hpNow <= 0;
}
