/**
 * Attack Power (攻撃力) Calculator
 *
 * Computes basic attack power per battle phase, applies the soft damage cap
 * and post-cap attack type modifiers.
 *
 * Formulas (2021+ caps; 改修 = equipment improvement bonus, see
 * improvement_bonus.ts):
 *   昼砲撃(水上艦):   基本攻撃力 = 火力 + 改修 + 5
 *   昼砲撃(空母):     基本攻撃力 = ⌊(火力 + 雷装 + ⌊1.3×爆装⌋ + 改修) × 1.5⌋ + 55
 *   雷撃:             基本攻撃力 = 雷装 + 改修 + 5
 *   対潜:             基本攻撃力 = 2×√素対潜 + 1.5×装備対潜 + 改修 + 8/13
 *   夜戦:             基本攻撃力 = 火力 + 雷装 + 改修
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

/** 対潜戦キャップ */
export const ANTI_SUBMARINE_CAP = 170;

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

/**
 * Final attack power for attack-type modifiers that are applied before the
 * soft cap (for example night battle cut-ins and double attacks).
 */
export function finalPreCapModifierAttackPower(basePower: number, cap: number, modifier: number): number {
  return Math.floor(applySoftCap(basePower * modifier, cap));
}

/** Critical (爆击) power for a final per-hit power. */
export function criticalPower(finalPower: number): number {
  return Math.floor(finalPower * CRITICAL_MODIFIER);
}

// ==================== Basic Attack Power ====================

/**
 * Day shelling basic power for surface ships.
 * @param firepower displayed firepower (incl. equipment)
 * @param improvement 改修強化値 (dayImprovementBonus)
 */
export function daySurfaceBasePower(firepower: number, improvement: number = 0): number {
  return firepower + improvement + 5;
}

/**
 * Day shelling basic power for carriers (空母系).
 * @param firepower displayed firepower (incl. equipment)
 * @param torpedo equipment torpedo stat total (displayed 雷装 works: carrier
 *                base 雷装 is 0, so displayed value equals equipment total)
 * @param bomb equipment bomb stat total (爆装)
 * @param improvement 改修強化値 (carrierDayImprovementBonus, ×1.5 の括弧内に加算)
 */
export function dayCarrierBasePower(firepower: number, torpedo: number, bomb: number, improvement: number = 0): number {
  return Math.floor((firepower + torpedo + Math.floor(1.3 * bomb) + improvement) * 1.5) + 55;
}

/**
 * Torpedo phase basic power.
 * @param torpedo displayed torpedo stat (incl. equipment)
 * @param improvement 改修強化値 (torpedoImprovementBonus)
 */
export function torpedoBasePower(torpedo: number, improvement: number = 0): number {
  return torpedo + improvement + 5;
}

/**
 * Anti-submarine basic power.
 *
 * displayedAsw includes equipment; the formula uses intrinsic ship ASW plus
 * only ASW-contributing equipment separately.
 */
export function antiSubmarineBasePower(
  displayedAsw: number,
  allEquipmentAsw: number,
  attackEquipmentAsw: number,
  improvement: number = 0,
  aircraftAttack: boolean = false,
): number {
  const shipAsw = Math.max(0, displayedAsw - allEquipmentAsw);
  return 2 * Math.sqrt(shipAsw)
    + 1.5 * attackEquipmentAsw
    + improvement
    + (aircraftAttack ? 8 : 13);
}

/** Night battle basic power for surface ships. */
export function nightBasePower(firepower: number, torpedo: number, improvement: number = 0): number {
  return firepower + torpedo + improvement;
}

/** Per-slot input for the carrier night air attack formula. */
export interface CarrierNightPlanePowerInput {
  firepower: number;
  torpedo: number;
  bomb: number;
  asw: number;
  /** Equipment improvement level (0..10), not aircraft proficiency. */
  level: number;
  /** Current aircraft count in the slot. */
  onslot: number;
  /** True for proper night fighters/attackers/dive bombers (A=3, B=0.45). */
  fullNightModifier: boolean;
}

/**
 * Carrier night air attack basic power.
 *
 * Only the carrier's intrinsic firepower and embarked night-capable planes
 * participate. Proper night planes use A=3/B=0.45; Swordfish variants, Iwai
 * fighter-bomber and the photoelectric-fuze Suisei use A=0/B=0.30.
 */
export function carrierNightBasePower(
  shipBaseFirepower: number,
  planes: ReadonlyArray<CarrierNightPlanePowerInput>,
  contactBonus: number = 0,
): number {
  let power = shipBaseFirepower + contactBonus;
  for (const plane of planes) {
    if (plane.onslot <= 0) continue;
    const stats = plane.firepower + plane.torpedo + plane.bomb + plane.asw;
    const slotRoot = Math.sqrt(plane.onslot);
    const slotModifier = plane.fullNightModifier
      ? 3 * plane.onslot + 0.45 * stats * slotRoot
      : 0.3 * stats * slotRoot;
    power += plane.firepower
      + plane.torpedo
      + plane.bomb
      + slotModifier
      + Math.sqrt(Math.max(0, plane.level));
  }
  return power;
}
