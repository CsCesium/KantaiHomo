/**
 * BattleResult Normalizer
 * 处理 api_req_sortie/battleresult, api_req_practice/battle_result 等 API
 */

import type { ApiBattleResultEscapeRaw, ApiBattleResultRaw, ApiPracticeBattleResultRaw } from '../api/battle_result';
import type { ApiMaybeEnvelope } from '../common';

// ==================== Normalized Types ====================

export interface BattleResultDrop {
  shipId?: number;
  shipName?: string;
  itemId?: number;
  itemName?: string;
  slotItemId?: number;
}

export interface BattleResultExp {
  base: number;
  total: number;
  shipExp: number[];
  shipExpLvUp: number[][];
}

export interface BattleResultMvp {
  main?: number;       // 1-based index
  combined?: number;   // 1-based index for combined fleet
}

export interface BattleResultEnemy {
  level: string;
  rank: string;
  deckName: string;
}

export interface BattleResultEscapeCandidate {
  targetShipIndexes: number[]; // 1-based positions from api_escape_idx
  towingShipIndexes: number[]; // 1-based positions from api_tow_idx
  escapeType: number;
}

export interface NormalizedBattleResult {
  rank: string;  // S/A/B/C/D/E

  exp: BattleResultExp;
  expCombined?: BattleResultExp;

  mvp: BattleResultMvp;

  enemy: BattleResultEnemy;

  drop?: BattleResultDrop;

  // 特殊标记
  firstClear?: boolean;
  escape?: BattleResultEscapeCandidate;
  escapeFlag?: number[];

  // 演习专用
  memberLv?: number;
  memberExp?: number;
  getMemberExp?: number;

  // 原始时间戳
  normalizedAt: number;
}

// ==================== Normalizer Functions ====================

/**
 * 标准化战斗结果数据
 */
export function normalizeBattleResult(
  raw: ApiMaybeEnvelope<ApiBattleResultRaw>,
  now = Date.now()
): NormalizedBattleResult {
  const data = unwrapApiData(raw);

  return {
    rank: data.api_win_rank,

    exp: {
      base: data.api_get_base_exp,
      total: data.api_get_exp,
      shipExp: data.api_get_ship_exp ?? [],
      shipExpLvUp: data.api_get_exp_lvup ?? [],
    },

    expCombined: data.api_get_ship_exp_combined ? {
      base: data.api_get_base_exp,
      total: data.api_get_exp,
      shipExp: data.api_get_ship_exp_combined,
      shipExpLvUp: data.api_get_exp_lvup_combined ?? [],
    } : undefined,

    mvp: {
      main: data.api_mvp,
      combined: data.api_mvp_combined,
    },

    enemy: {
      level: data.api_enemy_info.api_level,
      rank: data.api_enemy_info.api_rank,
      deckName: data.api_enemy_info.api_deck_name,
    },

    drop: extractDrop(data),

    firstClear: data.api_first_clear === 1,
    escape: normalizeEscapeCandidate(data.api_escape),
    escapeFlag: data.api_escape_flag,

    normalizedAt: now,
  };
}

/**
 * 标准化演习结果数据
 */
export function normalizePracticeBattleResult(
  raw: ApiMaybeEnvelope<ApiPracticeBattleResultRaw>,
  now = Date.now()
): NormalizedBattleResult {
  const data = unwrapApiData(raw);

  return {
    rank: data.api_win_rank,

    exp: {
      base: data.api_get_base_exp,
      total: data.api_get_exp,
      shipExp: data.api_get_ship_exp ?? [],
      shipExpLvUp: data.api_get_exp_lvup ?? [],
    },

    mvp: {
      main: data.api_mvp,
    },

    enemy: {
      level: data.api_enemy_info.api_level,
      rank: data.api_enemy_info.api_rank,
      deckName: data.api_enemy_info.api_deck_name,
    },

    memberLv: data.api_member_lv,
    memberExp: data.api_member_exp,
    getMemberExp: data.api_get_member_exp,

    normalizedAt: now,
  };
}

// ==================== Helpers ====================

function unwrapApiData<T>(raw: ApiMaybeEnvelope<T>): T {
  if (raw && typeof raw === 'object' && 'api_data' in (raw as object)) {
    return (raw as { api_data: T }).api_data;
  }
  return raw as T;
}

function extractDrop(data: ApiBattleResultRaw): BattleResultDrop | undefined {
  const hasShip = !!data.api_get_ship;
  const hasItem = !!data.api_get_useitem;
  const hasSlotItem = !!data.api_get_slotitem;

  if (!hasShip && !hasItem && !hasSlotItem) {
    return undefined;
  }

  return {
    shipId: data.api_get_ship?.api_ship_id,
    shipName: data.api_get_ship?.api_ship_name,
    itemId: data.api_get_useitem?.api_useitem_id,
    itemName: data.api_get_useitem?.api_useitem_name,
    slotItemId: data.api_get_slotitem?.api_slotitem_id,
  };
}

function normalizeNumberArray(value: number[] | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: number): number => Number(item))
    .filter((item: number): boolean => Number.isFinite(item) && item > 0);
}

function normalizeEscapeCandidate(data: ApiBattleResultEscapeRaw | undefined): BattleResultEscapeCandidate | undefined {
  if (!data) return undefined;
  const targetShipIndexes = normalizeNumberArray(data.api_escape_idx);
  const towingShipIndexes = normalizeNumberArray(data.api_tow_idx);
  if (targetShipIndexes.length === 0 && towingShipIndexes.length === 0) {
    return undefined;
  }
  return {
    targetShipIndexes,
    towingShipIndexes,
    escapeType: Number(data.api_escape_type ?? 0),
  };
}

// ==================== Utility Functions ====================

/**
 * 判断是否是演习结果
 */
export function isPracticeResult(apiPath: string): boolean {
  return apiPath.includes('practice');
}

/**
 * 从 MVP 索引获取舰船位置 (转为 0-based)
 */
export function getMvpIndex(mvp: number | undefined): number | undefined {
  if (mvp === undefined || mvp <= 0) return undefined;
  return mvp - 1;
}

/**
 * 获取指定位置舰船的经验增量
 */
export function getShipExpGain(result: NormalizedBattleResult, index: number, isCombined = false): number {
  const exp = isCombined ? result.expCombined : result.exp;
  if (!exp) return 0;

  const shipExp = exp.shipExp[index];
  if (typeof shipExp !== 'number') return 0;

  return shipExp;
}

/**
 * 检查指定位置舰船是否升级
 */
export function didShipLevelUp(result: NormalizedBattleResult, index: number, isCombined = false): boolean {
  const exp = isCombined ? result.expCombined : result.exp;
  if (!exp) return false;

  const lvUp = exp.shipExpLvUp[index];
  if (!Array.isArray(lvUp) || lvUp.length < 2) return false;

  // lvUp = [currentExp, nextLevelExp, ...]
  // 如果数组长度 > 2，说明有升级
  return lvUp.length > 2;
}

/**
 * 获取升级后的新等级数量
 */
export function getLevelUpCount(result: NormalizedBattleResult, index: number, isCombined = false): number {
  const exp = isCombined ? result.expCombined : result.exp;
  if (!exp) return 0;

  const lvUp = exp.shipExpLvUp[index];
  if (!Array.isArray(lvUp)) return 0;

  // lvUp 数组长度 - 2 就是升级次数
  return Math.max(0, lvUp.length - 2);
}
