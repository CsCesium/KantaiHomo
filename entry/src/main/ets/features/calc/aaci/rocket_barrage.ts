import { SlotItemMaster, SlotItemEquipType } from "../../../domain/models";

export const ROCKET_BARRAGE_DIVISOR = 282;
export const SECOND_ROCKET_BONUS = 0.15;
export const ISE_CLASS_BONUS_MULTIPLIER = 1.4;
export const ISE_K2_BONUS_MULTIPLIER = 1.6;
export const ROCKET_LAUNCHER_K2_ID = 274;
export const ROCKET_LAUNCHER_ID = 51;

export const ROCKET_BARRAGE_CAPABLE_STYPES: Set<number> = new Set([
  7,   // 軽空母
  9,   // 正規空母 (装甲空母も同じ)
  10,  // 航空戦艦
  11,  // 正規空母
  14,  // 潜水空母 (発動不可だが念のため)
  16,  // 水上機母艦
  18,  // 装甲空母
  6,   // 航空巡洋艦
]);

export const ACTUAL_CAPABLE_STYPES: Set<number> = new Set([
  6,   // 航空巡洋艦
  7,   // 軽空母
  10,  // 航空戦艦
  11,  // 正規空母
  16,  // 水上機母艦
  18,  // 装甲空母
]);

export const ISE_CLASS_IDS: Set<number> = new Set([
  77,   // 伊勢
  87,   // 伊勢改
  553,  // 伊勢改二
  78,   // 日向
  88,   // 日向改
  554,  // 日向改二
]);

export const ISE_K2_IDS: Set<number> = new Set([
  553,  // 伊勢改二
  554,  // 日向改二
]);

export const GOTLAND_IDS: Set<number> = new Set([
  574,  // Gotland
  579,  // Gotland改
  630,  // Gotland andra
]);

export const AA_WEIGHT_COEFFICIENTS: Record<string, number> = {
  aaGun: 6,        // 機銃
  highAngle: 4,    // 高角砲
  radar: 3,        // 電探
  other: 0,        // その他
};

export const AA_IMPROVEMENT_COEFFICIENTS: Record<string, number> = {
  aaGun: 4,        // 機銃
  highAngle: 3,    // 高角砲
  radar: 0,        // 電探 (改修で加重対空は上がらない)
  other: 0,        // その他
};

export function calcEquipWeightedAA(
  master: SlotItemMaster,
  level: number = 0,
): number {
  const aa = master.stats.aa;

  // 機銃
  if (master.type.equipType === SlotItemEquipType.AAGun) {
    return aa * AA_WEIGHT_COEFFICIENTS.aaGun +
      level * AA_IMPROVEMENT_COEFFICIENTS.aaGun;
  }

  // 高角砲 (アイコンで判定)
  if (master.type.iconId === 16) { // HighAngleGun
    return aa * AA_WEIGHT_COEFFICIENTS.highAngle +
      level * AA_IMPROVEMENT_COEFFICIENTS.highAngle;
  }

  // 電探
  if (master.type.equipType === SlotItemEquipType.SmallRadar ||
    master.type.equipType === SlotItemEquipType.LargeRadar ||
    master.type.equipType === SlotItemEquipType.LargeRadarII) {
    return aa * AA_WEIGHT_COEFFICIENTS.radar;
  }

  // その他
  return 0;
}

/**
 * 艦娘の加重対空値を計算
 *
 * @param shipAA 艦娘素対空値
 * @param equips 装備一覧 [{master, level}]
 * @returns 加重対空値
 */
export function calcWeightedAA(
  shipAA: number,
  equips: Array<{ master: SlotItemMaster; level: number }>,
): number {
  let weightedAA = shipAA;

  for (const equip of equips) {
    weightedAA += calcEquipWeightedAA(equip.master, equip.level);
  }

  return weightedAA;
}

export function countRocketLauncherK2(
  equips: Array<{ master: SlotItemMaster; level: number }>,
): number {
  return equips.filter(e => e.master.id === ROCKET_LAUNCHER_K2_ID).length;
}

/**
 * 対空噴進弾幕の発動率を計算
 *
 * @param shipMasterId 艦娘 Master ID
 * @param stype 艦種
 * @param shipAA 艦娘の素対空値
 * @param luck 艦娘の運
 * @param equips 装備一覧 [{master, level}]
 * @returns 発動率 (0-1)、発動不可の場合は null
 */
export function calcRocketBarrageRate(
  shipMasterId: number,
  stype: number,
  shipAA: number,
  luck: number,
  equips: Array<{ master: SlotItemMaster; level: number }>,
): number | null {
  if (!ACTUAL_CAPABLE_STYPES.has(stype)) {
    return null;
  }

  if (GOTLAND_IDS.has(shipMasterId)) {
    return null;
  }

  const rocketCount = countRocketLauncherK2(equips);
  if (rocketCount === 0) {
    return null;
  }

  const weightedAA = calcWeightedAA(shipAA, equips);

  let rate = (weightedAA + luck) / ROCKET_BARRAGE_DIVISOR;

  if (rocketCount >= 2) {
    rate += SECOND_ROCKET_BONUS;
  }

  if (ISE_K2_IDS.has(shipMasterId)) {
    rate *= ISE_K2_BONUS_MULTIPLIER;
  } else if (ISE_CLASS_IDS.has(shipMasterId)) {
    rate *= ISE_CLASS_BONUS_MULTIPLIER;
  }

  return Math.max(0, Math.min(1, rate));
}

export interface RocketBarrageRateResult {
  /** 艦娘 UID */
  shipUid: number;
  /** 艦娘 Master ID */
  shipMasterId: number;
  /** 発動可能 */
  canTrigger: boolean;
  /** 発動率 (0-1) */
  rate: number;
  /** 加重対空値 */
  weightedAA: number;
  /** 噴進砲改二の装備数 */
  rocketCount: number;
  /** 伊勢型補正 */
  hasIseBonus: boolean;
  /** 伊勢改二補正 */
  hasIseK2Bonus: boolean;
  /** 100%達成に必要な追加加重対空値 (達成済みなら0) */
  aaNeededFor100: number;
}

export function calcRocketBarrageResult(
  shipUid: number,
  shipMasterId: number,
  stype: number,
  shipAA: number,
  luck: number,
  equips: Array<{ master: SlotItemMaster; level: number }>,
): RocketBarrageRateResult {
  const rocketCount = countRocketLauncherK2(equips);
  const weightedAA = calcWeightedAA(shipAA, equips);
  const rate = calcRocketBarrageRate(shipMasterId, stype, shipAA, luck, equips);

  const canTrigger = rate !== null;
  const actualRate = rate ?? 0;

  const hasIseK2Bonus = ISE_K2_IDS.has(shipMasterId);
  const hasIseBonus = ISE_CLASS_IDS.has(shipMasterId) && !hasIseK2Bonus;

  // 100%達成に必要な加重対空値を計算
  let aaNeededFor100 = 0;
  if (canTrigger && actualRate < 1) {
    // 逆算: rate = (weightedAA + luck + bonus) * multiplier / 282
    // 100% の場合: 1 = (targetAA + luck + bonus) * multiplier / 282
    // targetAA = 282 / multiplier - luck - bonus
    let multiplier = 1;
    if (hasIseK2Bonus) {
      multiplier = ISE_K2_BONUS_MULTIPLIER;
    } else if (hasIseBonus) {
      multiplier = ISE_CLASS_BONUS_MULTIPLIER;
    }

    const bonus = rocketCount >= 2 ? SECOND_ROCKET_BONUS * ROCKET_BARRAGE_DIVISOR : 0;
    const targetTotal = ROCKET_BARRAGE_DIVISOR / multiplier;
    const currentTotal = weightedAA + luck;
    aaNeededFor100 = Math.max(0, Math.ceil(targetTotal - currentTotal));
  }

  return {
    shipUid,
    shipMasterId,
    canTrigger,
    rate: actualRate,
    weightedAA,
    rocketCount,
    hasIseBonus,
    hasIseK2Bonus,
    aaNeededFor100,
  };
}

/**
 * 発動率100%に必要な条件を計算
 *
 * @param shipAA 艦娘の素対空
 * @param luck 艦娘の運
 * @param shipMasterId 艦娘 Master ID (伊勢型判定用)
 * @param rocketCount 噴進砲改二の数 (1 or 2)
 * @returns 必要な追加加重対空値
 */
export function calcAANeededFor100Percent(
  shipAA: number,
  luck: number,
  shipMasterId: number,
  rocketCount: number = 1,
): number {
  // 伊勢型補正
  let multiplier = 1;
  if (ISE_K2_IDS.has(shipMasterId)) {
    multiplier = ISE_K2_BONUS_MULTIPLIER;
  } else if (ISE_CLASS_IDS.has(shipMasterId)) {
    multiplier = ISE_CLASS_BONUS_MULTIPLIER;
  }

  // 2積み補正
  const bonus = rocketCount >= 2 ? SECOND_ROCKET_BONUS * ROCKET_BARRAGE_DIVISOR : 0;

  // 100%に必要な (加重対空 + 運)
  const targetTotal = ROCKET_BARRAGE_DIVISOR / multiplier - bonus;

  // 現在の加重対空 + 運
  const currentTotal = shipAA + luck;

  // 不足分
  return Math.max(0, Math.ceil(targetTotal - currentTotal));
}

export interface FleetRocketBarrageResult {
  shipResults: RocketBarrageRateResult[];
  capableShipCount: number;
  allTriggerRate: number;
  anyTriggerRate: number;
}

export function calcFleetRocketBarrageResult(
  shipResults: RocketBarrageRateResult[],
): FleetRocketBarrageResult {
  const capableShips = shipResults.filter(s => s.canTrigger);
  const capableShipCount = capableShips.length;

  if (capableShipCount === 0) {
    return {
      shipResults,
      capableShipCount: 0,
      allTriggerRate: 0,
      anyTriggerRate: 0,
    };
  }

  const allTriggerRate = capableShips.reduce((acc, s) => acc * s.rate, 1);

  const anyTriggerRate = 1 - capableShips.reduce((acc, s) => acc * (1 - s.rate), 1);

  return {
    shipResults,
    capableShipCount,
    allTriggerRate,
    anyTriggerRate,
  };
}

export function calcMachineGunsNeededFor100(
  shipAA: number,
  luck: number,
  shipMasterId: number,
  rocketCount: number = 1,
  machineGunAA: number = 9, // 機銃の対空値
): number {
  const aaNeeded = calcAANeededFor100Percent(shipAA, luck, shipMasterId, rocketCount);

  // 機銃の加重対空 = 対空 × 6
  const mgWeightedAA = machineGunAA * AA_WEIGHT_COEFFICIENTS.aaGun;

  return Math.ceil(aaNeeded / mgWeightedAA);
}
