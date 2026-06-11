/**
 * Attack Power (攻撃力) Calculator
 *
 * Computes basic attack power per battle phase, applies the soft damage cap
 * and post-cap attack type modifiers.
 *
 * Formulas (2021+ caps):
 *   昼砲撃(水上艦):   基本攻撃力 = 火力 + 5
 *   昼砲撃(空母):     基本攻撃力 = ⌊(火力 + 雷装 + ⌊1.3×爆装⌋) × 1.5⌋ + 55
 *   雷撃:             基本攻撃力 = 雷装 + 5
 *   夜戦:             基本攻撃力 = 火力 + 雷装
 *
 *   キャップ後攻撃力 = cap + √(基本攻撃力 - cap)   (基本攻撃力 > cap 时)
 *   クリティカル     = ⌊攻撃力 × 1.5⌋
 *
 * Reference: https://wikiwiki.jp/kancolle/戦闘について
 */

// ==================== Damage Caps ====================

/** 昼砲撃戦キャップ */
export const DAY_BATTLE_CAP = 220;

/** 雷撃戦キャップ */
export const TORPEDO_BATTLE_CAP = 180;

/** 夜戦キャップ */
export const NIGHT_BATTLE_CAP = 360;

/** Critical hit modifier (爆击) */
export const CRITICAL_MODIFIER = 1.5;

// ==================== Cap / Modifier Application ====================

/**
 * Apply the soft damage cap: power above the cap only counts as √over.
 */
export function applySoftCap(power: number, cap: number): number {
  if (power <= cap) return power;
  return cap + Math.sqrt(power - cap);
}

/**
 * Final per-hit attack power: soft cap, then post-cap type modifier, floored.
 */
export function finalAttackPower(basePower: number, cap: number, modifier: number): number {
  return Math.floor(applySoftCap(basePower, cap) * modifier);
}

/** Critical (爆击) power for a final per-hit power. */
export function criticalPower(finalPower: number): number {
  return Math.floor(finalPower * CRITICAL_MODIFIER);
}

// ==================== Basic Attack Power ====================

/**
 * Day shelling basic power for surface ships.
 * @param firepower displayed firepower (incl. equipment)
 */
export function daySurfaceBasePower(firepower: number): number {
  return firepower + 5;
}

/**
 * Day shelling basic power for carriers (空母系).
 * @param firepower displayed firepower (incl. equipment)
 * @param torpedo equipment torpedo stat total (displayed 雷装 works: carrier
 *                base 雷装 is 0, so displayed value equals equipment total)
 * @param bomb equipment bomb stat total (爆装)
 */
export function dayCarrierBasePower(firepower: number, torpedo: number, bomb: number): number {
  return Math.floor((firepower + torpedo + Math.floor(1.3 * bomb)) * 1.5) + 55;
}

/**
 * Torpedo phase basic power.
 * @param torpedo displayed torpedo stat (incl. equipment)
 */
export function torpedoBasePower(torpedo: number): number {
  return torpedo + 5;
}

/**
 * Night battle basic power for surface ships (and the panel's estimate for
 * night-capable carriers; the exact carrier night formula needs per-plane
 * night stats which are not tracked).
 */
export function nightBasePower(firepower: number, torpedo: number): number {
  return firepower + torpedo;
}
