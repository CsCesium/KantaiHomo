/**
 * Equipment Improvement (改修) Attack Power Bonus
 *
 * 改修強化値 added to basic attack power, per battle phase. Coefficients
 * differ by phase and equipment category:
 *
 *   昼砲撃戦:
 *     大口径主砲:                 +1.5×√★
 *     小/中口径主砲・徹甲弾・三式弾・探照灯・高射装置・大発系: +√★
 *     副砲: 黄色副砲 +0.3×★ / 高角副砲(高角砲アイコン) +0.2×★
 *     空母(艦攻・艦爆):           +0.2×★ (基本攻撃力の括弧内に加算)
 *   雷撃戦:
 *     魚雷・機銃:                 +1.2×√★
 *   夜戦:
 *     主砲(全)・魚雷・徹甲弾・探照灯・高射装置・大発系: +√★
 *     副砲: 昼戦と同じ 0.3×★ / 0.2×★
 *   対潜:
 *     ソナー・爆雷系: +√★
 *
 * Reference: https://wikiwiki.jp/kancolle/改修工廠
 */

import { ScenarioEquip } from './damage_types';
import { SlotItemEquipType, SlotItemIconId } from '../../../domain/models';

function sqrtStar(level: number): number {
  return Math.sqrt(Math.max(0, level));
}

function isMainGunType(t: number): boolean {
  return t === SlotItemEquipType.SmallCaliberMainGun
    || t === SlotItemEquipType.MediumCaliberMainGun
    || t === SlotItemEquipType.LargeCaliberMainGun
    || t === SlotItemEquipType.LargeCaliberMainGunII;
}

function isLargeCaliberMainGun(t: number): boolean {
  return t === SlotItemEquipType.LargeCaliberMainGun
    || t === SlotItemEquipType.LargeCaliberMainGunII;
}

function isTorpedoType(t: number): boolean {
  return t === SlotItemEquipType.Torpedo || t === SlotItemEquipType.SubmarineTorpedo;
}

function isAntiSubImprovementType(t: number): boolean {
  return t === SlotItemEquipType.Sonar
    || t === SlotItemEquipType.LargeSonar
    || t === SlotItemEquipType.DepthCharge;
}

/** 改修√★ が火力に乗る共通カテゴリ（主砲以外） */
function isSqrtStarFirepowerType(t: number): boolean {
  return t === SlotItemEquipType.APShell
    || t === SlotItemEquipType.AAShell
    || t === SlotItemEquipType.Searchlight
    || t === SlotItemEquipType.LargeSearchlight
    || t === SlotItemEquipType.AADirector
    || t === SlotItemEquipType.LandingCraft
    || t === SlotItemEquipType.SpecialAmphibious;
}

/** 副砲改修: 黄色副砲 0.3×★、高角副砲 0.2×★ */
function secondaryGunBonus(equip: ScenarioEquip): number {
  if (equip.iconType === SlotItemIconId.HighAngleGun) {
    return 0.2 * equip.level;
  }
  return 0.3 * equip.level;
}

/** 昼砲撃戦の改修強化値（水上艦） */
export function dayImprovementBonus(equips: ReadonlyArray<ScenarioEquip>): number {
  let bonus = 0;
  for (const eq of equips) {
    if (eq.level <= 0) continue;
    const t = eq.equipType;
    if (isLargeCaliberMainGun(t)) {
      bonus += 1.5 * sqrtStar(eq.level);
    } else if (isMainGunType(t) || isSqrtStarFirepowerType(t)) {
      bonus += sqrtStar(eq.level);
    } else if (t === SlotItemEquipType.SecondaryGun) {
      bonus += secondaryGunBonus(eq);
    }
  }
  return bonus;
}

/** 空母昼砲撃の改修強化値（基本攻撃力の括弧内に加算；艦攻・艦爆 +0.2×★） */
export function carrierDayImprovementBonus(equips: ReadonlyArray<ScenarioEquip>): number {
  let bonus = 0;
  for (const eq of equips) {
    if (eq.level <= 0) continue;
    const t = eq.equipType;
    if (t === SlotItemEquipType.CarrierTorpedoBomber || t === SlotItemEquipType.CarrierDiveBomber) {
      bonus += 0.2 * eq.level;
    } else if (isSqrtStarFirepowerType(t) || isMainGunType(t)) {
      bonus += sqrtStar(eq.level);
    } else if (t === SlotItemEquipType.SecondaryGun) {
      bonus += secondaryGunBonus(eq);
    }
  }
  return bonus;
}

/** 雷撃戦の改修強化値（魚雷・機銃 +1.2×√★） */
export function torpedoImprovementBonus(equips: ReadonlyArray<ScenarioEquip>): number {
  let bonus = 0;
  for (const eq of equips) {
    if (eq.level <= 0) continue;
    const t = eq.equipType;
    if (isTorpedoType(t) || t === SlotItemEquipType.AAGun) {
      bonus += 1.2 * sqrtStar(eq.level);
    }
  }
  return bonus;
}

/** 対潜攻撃の改修強化値（ソナー・爆雷系 +√★） */
export function antiSubmarineImprovementBonus(equips: ReadonlyArray<ScenarioEquip>): number {
  let bonus = 0;
  for (const eq of equips) {
    if (eq.level <= 0) continue;
    if (isAntiSubImprovementType(eq.equipType)) {
      bonus += sqrtStar(eq.level);
    }
  }
  return bonus;
}

/** 夜戦の改修強化値（主砲・魚雷等 +√★、副砲 0.3×★/0.2×★） */
export function nightImprovementBonus(equips: ReadonlyArray<ScenarioEquip>): number {
  let bonus = 0;
  for (const eq of equips) {
    if (eq.level <= 0) continue;
    const t = eq.equipType;
    if (isMainGunType(t) || isTorpedoType(t) || isSqrtStarFirepowerType(t)) {
      bonus += sqrtStar(eq.level);
    } else if (t === SlotItemEquipType.SecondaryGun) {
      bonus += secondaryGunBonus(eq);
    }
  }
  return bonus;
}
