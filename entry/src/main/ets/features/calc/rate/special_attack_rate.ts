/**
 * Battleship Special Attack (特殊攻撃) Activation Rate Calculator
 *
 * Calculates activation rates for various special attacks:
 * - Nelson Touch
 * - Nagato/Mutsu Touch (長門型一斉射)
 * - Colorado Touch
 * - Richelieu Touch
 * - Warspite/Valiant Touch
 * - Yamato Touch (大和型特殊攻撃)
 * - Kongou Night Attack (僚艦夜戦突撃)
 *
 * Reference: https://wikiwiki.jp/kancolle/Nelson
 * Reference: https://zekamashi.net/kancolle-kouryaku/nagato-skill/
 */

import {
  Formation,
  FleetType,
  DamageState,
  clampRate,
  MAX_RATE,
} from './rate_types';

// ==================== Special Attack Types ====================

/**
 * Special attack type
 */
export enum SpecialAttackType {
  /** ネルソンタッチ - Nelson Touch */
  NelsonTouch = 'nelson_touch',
  /** 長門タッチ - Nagato Touch */
  NagatoTouch = 'nagato_touch',
  /** 陸奥タッチ - Mutsu Touch */
  MutsuTouch = 'mutsu_touch',
  /** コロラドタッチ - Colorado Touch */
  ColoradoTouch = 'colorado_touch',
  /** リシュリュータッチ - Richelieu Touch */
  RichelieuTouch = 'richelieu_touch',
  /** ウォースパイトタッチ - Warspite Touch */
  WarspiteTouch = 'warspite_touch',
  /** 大和タッチ(2隻) - Yamato Touch (2 ships) */
  YamatoTouch2 = 'yamato_touch_2',
  /** 大和タッチ(3隻) - Yamato Touch (3 ships) */
  YamatoTouch3 = 'yamato_touch_3',
  /** 僚艦夜戦突撃 - Kongou Night Attack */
  KongouNightAttack = 'kongou_night_attack',
}

/**
 * Ship positions involved in special attack
 */
export interface SpecialAttackPositions {
  /** Type determines which positions are used */
  type: SpecialAttackType;
  /** Position pattern: 1-3-5 (Nelson), 1-2 (Nagato), 1-2-3 (Colorado/Yamato) */
  positions: number[];
}

/**
 * Get attack positions for special attack type
 */
export function getAttackPositions(type: SpecialAttackType): number[] {
  switch (type) {
    case SpecialAttackType.NelsonTouch:
      return [1, 3, 5]; // 1番艦, 3番艦, 5番艦
    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
    case SpecialAttackType.RichelieuTouch:
    case SpecialAttackType.WarspiteTouch:
    case SpecialAttackType.YamatoTouch2:
      return [1, 2]; // 1番艦, 2番艦
    case SpecialAttackType.ColoradoTouch:
    case SpecialAttackType.YamatoTouch3:
      return [1, 2, 3]; // 1番艦, 2番艦, 3番艦
    case SpecialAttackType.KongouNightAttack:
      return [1, 2]; // Flagship + 2nd (special rules)
    default:
      return [];
  }
}

// ==================== Required Formations ====================

/**
 * Check if formation allows special attack
 */
export function allowsSpecialAttack(
  type: SpecialAttackType,
  formation: Formation,
  fleetType: FleetType,
): boolean {
  switch (type) {
    case SpecialAttackType.NelsonTouch:
      // 複縦陣 or 第二警戒航行序列
      if (fleetType === FleetType.Normal) {
        return formation === Formation.DoubleLine;
      } else {
        return formation === Formation.CruisingFormation2;
      }

    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
    case SpecialAttackType.ColoradoTouch:
    case SpecialAttackType.RichelieuTouch:
    case SpecialAttackType.WarspiteTouch:
      // 梯形陣 or 第二警戒航行序列
      if (fleetType === FleetType.Normal) {
        return formation === Formation.Echelon;
      } else {
        return formation === Formation.CruisingFormation2;
      }

    case SpecialAttackType.YamatoTouch2:
    case SpecialAttackType.YamatoTouch3:
      // 第四警戒航行序列 (combined fleet only)
      return formation === Formation.CruisingFormation4;

    case SpecialAttackType.KongouNightAttack:
      // Night battle only, various formations
      return true;

    default:
      return false;
  }
}

// ==================== Flagship Ships ====================

/**
 * Ship master IDs that can activate special attacks as flagship
 */
export const SPECIAL_ATTACK_FLAGSHIP_IDS: Record<SpecialAttackType, Set<number>> = {
  [SpecialAttackType.NelsonTouch]: new Set([
    571, // Nelson
    576, // Nelson改
    573, // Rodney
    // Add more as needed
  ]),
  [SpecialAttackType.NagatoTouch]: new Set([
    541, // 長門改二
  ]),
  [SpecialAttackType.MutsuTouch]: new Set([
    573, // 陸奥改二
  ]),
  [SpecialAttackType.ColoradoTouch]: new Set([
    601, // Colorado
    1496, // Colorado改
    913, // Maryland
    918, // Maryland改
  ]),
  [SpecialAttackType.RichelieuTouch]: new Set([
    492, // Richelieu改
    1037, // Richelieu Deux
    // Jean Bart as 2nd ship
  ]),
  [SpecialAttackType.WarspiteTouch]: new Set([
    364, // Warspite
    439, // Warspite改
    // Valiant as 2nd ship
  ]),
  [SpecialAttackType.YamatoTouch2]: new Set([
    911, // 大和改二
    916, // 大和改二重
  ]),
  [SpecialAttackType.YamatoTouch3]: new Set([
    911, // 大和改二
    916, // 大和改二重
  ]),
  [SpecialAttackType.KongouNightAttack]: new Set([
    591, // 金剛改二丙
    593, // 比叡改二丙
    954, // 榛名改二乙
    1573, // 榛名改二丙
    995, // 霧島改二丙
  ]),
};

// ==================== Rate Calculation ====================

/**
 * Special attack calculation input
 */
export interface SpecialAttackInput {
  /** Special attack type */
  type: SpecialAttackType;
  /** Flagship level */
  flagshipLevel: number;
  /** Flagship luck */
  flagshipLuck: number;
  /** Flagship damage state */
  flagshipDamageState: DamageState;
  /** Partner ship(s) levels */
  partnerLevels: number[];
  /** Partner ship(s) luck values */
  partnerLucks: number[];
  /** Has AP shell equipped */
  hasAPShell: boolean;
  /** Has LoS 5+ radar equipped */
  hasLoSRadar: boolean;
  /** Has special main gun bonus */
  hasMainGunBonus: boolean;
}

/**
 * Special attack calculation result
 */
export interface SpecialAttackResult {
  /** Activation rate (%) */
  rate: number;
  /** Rate formula used */
  formula: string;
  /** Breakdown of components */
  breakdown: {
    flagshipComponent: number;
    partnerComponent: number;
    luckComponent: number;
    baseComponent: number;
    equipmentBonus: number;
  };
  /** Can activate (all conditions met) */
  canActivate: boolean;
  /** Reason if cannot activate */
  reason?: string;
}

// ==================== Nelson Touch Rate ====================

/**
 * Calculate Nelson Touch activation rate
 *
 * Formula: floor(1.1×√(1番艦Lv) + 1.4×√(1番艦運) + √(3番艦Lv) + √(5番艦Lv) + 25)
 */
export function calcNelsonTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Nelson Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  // Need 2 partner ships (positions 3 and 5)
  if (input.partnerLevels.length < 2) {
    return {
      rate: 0,
      formula: 'Nelson Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  const flagshipComponent = 1.1 * Math.sqrt(input.flagshipLevel);
  const luckComponent = 1.4 * Math.sqrt(input.flagshipLuck);
  const partner3Component = Math.sqrt(input.partnerLevels[0]);
  const partner5Component = Math.sqrt(input.partnerLevels[1]);
  const partnerComponent = partner3Component + partner5Component;
  const baseComponent = 25;

  const rawRate = Math.floor(flagshipComponent + luckComponent + partnerComponent + baseComponent);
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(1.1×√Lv1 + 1.4×√運1 + √Lv3 + √Lv5 + 25)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus: 0,
    },
    canActivate: true,
  };
}

// ==================== Nagato/Mutsu Touch Rate ====================

/**
 * Calculate Nagato/Mutsu Touch activation rate
 *
 * Formula: floor(√(1番艦Lv) + √(2番艦Lv) + 1.5×(√(1番艦運) + √(2番艦運)) + 25)
 * Or: (√一番艦Lv + √二番艦Lv) + 1.2×(√一艦運 + √二番艦運) + 30
 */
export function calcNagatoTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Nagato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  // Need 1 partner ship (position 2)
  if (input.partnerLevels.length < 1 || input.partnerLucks.length < 1) {
    return {
      rate: 0,
      formula: 'Nagato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  const flagshipComponent = Math.sqrt(input.flagshipLevel);
  const partnerComponent = Math.sqrt(input.partnerLevels[0]);
  const luckComponent = 1.5 * (Math.sqrt(input.flagshipLuck) + Math.sqrt(input.partnerLucks[0]));
  const baseComponent = 25;

  // Equipment bonuses (estimates)
  let equipmentBonus = 0;
  if (input.hasAPShell) equipmentBonus += 1.35;
  if (input.hasLoSRadar) equipmentBonus += 1.25;
  if (input.hasAPShell && input.hasLoSRadar) equipmentBonus += 0.95; // Combined bonus

  const rawRate = Math.floor(
    flagshipComponent + partnerComponent + luckComponent + baseComponent + equipmentBonus
  );
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(√Lv1 + √Lv2 + 1.5×(√運1 + √運2) + 25 + equip)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus,
    },
    canActivate: true,
  };
}

// ==================== Colorado Touch Rate ====================

/**
 * Calculate Colorado Touch activation rate
 *
 * Formula: Similar to Nelson, uses positions 1, 2, 3
 */
export function calcColoradoTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Colorado Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  // Need 2 partner ships (positions 2 and 3)
  if (input.partnerLevels.length < 2) {
    return {
      rate: 0,
      formula: 'Colorado Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  // Similar formula to Nelson
  const flagshipComponent = 1.1 * Math.sqrt(input.flagshipLevel);
  const luckComponent = 1.4 * Math.sqrt(input.flagshipLuck);
  const partner2Component = Math.sqrt(input.partnerLevels[0]);
  const partner3Component = Math.sqrt(input.partnerLevels[1]);
  const partnerComponent = partner2Component + partner3Component;
  const baseComponent = 25;

  const rawRate = Math.floor(flagshipComponent + luckComponent + partnerComponent + baseComponent);
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(1.1×√Lv1 + 1.4×√運1 + √Lv2 + √Lv3 + 25)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus: 0,
    },
    canActivate: true,
  };
}

// ==================== Yamato Touch Rate ====================

/**
 * Calculate Yamato Touch activation rate
 *
 * Uses similar formula to Nagato but for combined fleet
 */
export function calcYamatoTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Yamato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  const requiredPartners = input.type === SpecialAttackType.YamatoTouch3 ? 2 : 1;
  if (input.partnerLevels.length < requiredPartners) {
    return {
      rate: 0,
      formula: 'Yamato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  const flagshipComponent = Math.sqrt(input.flagshipLevel);
  let partnerComponent = 0;
  let luckSum = Math.sqrt(input.flagshipLuck);

  for (let i = 0; i < requiredPartners; i++) {
    partnerComponent += Math.sqrt(input.partnerLevels[i] || 1);
    luckSum += Math.sqrt(input.partnerLucks[i] || 1);
  }

  const luckComponent = 1.5 * luckSum;
  const baseComponent = 25;

  const rawRate = Math.floor(flagshipComponent + partnerComponent + luckComponent + baseComponent);
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(√LvSum + 1.5×√運Sum + 25)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus: 0,
    },
    canActivate: true,
  };
}

// ==================== Generic Calculator ====================

/**
 * Calculate special attack activation rate
 */
export function calcSpecialAttackRate(input: SpecialAttackInput): SpecialAttackResult {
  switch (input.type) {
    case SpecialAttackType.NelsonTouch:
      return calcNelsonTouchRate(input);

    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
    case SpecialAttackType.RichelieuTouch:
    case SpecialAttackType.WarspiteTouch:
      return calcNagatoTouchRate(input);

    case SpecialAttackType.ColoradoTouch:
      return calcColoradoTouchRate(input);

    case SpecialAttackType.YamatoTouch2:
    case SpecialAttackType.YamatoTouch3:
      return calcYamatoTouchRate(input);

    case SpecialAttackType.KongouNightAttack:
      // Night attack uses different mechanics
      return calcNagatoTouchRate(input); // Simplified

    default:
      return {
        rate: 0,
        formula: 'Unknown',
        breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
        canActivate: false,
        reason: 'Unknown special attack type',
      };
  }
}

// ==================== Quick Calculation ====================

/**
 * Quick calculation for common scenarios
 */
export function quickCalcSpecialAttackRate(
  type: SpecialAttackType,
  flagshipLevel: number,
  flagshipLuck: number,
  partnerLevels: number[],
  partnerLucks: number[] = [],
): number {
  const result = calcSpecialAttackRate({
    type,
    flagshipLevel,
    flagshipLuck,
    flagshipDamageState: DamageState.Normal,
    partnerLevels,
    partnerLucks: partnerLucks.length > 0 ? partnerLucks : partnerLevels.map(() => 20),
    hasAPShell: false,
    hasLoSRadar: false,
    hasMainGunBonus: false,
  });

  return result.rate;
}

// ==================== Display Helpers ====================

/**
 * Get special attack type display name
 */
export function getSpecialAttackTypeName(type: SpecialAttackType): string {
  switch (type) {
    case SpecialAttackType.NelsonTouch:
      return 'Nelson Touch';
    case SpecialAttackType.NagatoTouch:
      return '一斉射かッ…胸が熱いな！';
    case SpecialAttackType.MutsuTouch:
      return '長門、いい？いくわよ！主砲一斉射ッ！';
    case SpecialAttackType.ColoradoTouch:
      return 'Colorado Touch';
    case SpecialAttackType.RichelieuTouch:
      return 'Richelieuよ！圧倒しなさいっ！';
    case SpecialAttackType.WarspiteTouch:
      return '姉妹艦連携砲撃';
    case SpecialAttackType.YamatoTouch2:
      return '大和、突撃します！';
    case SpecialAttackType.YamatoTouch3:
      return '第一戦隊、突撃！主砲、全力斉射ッ！';
    case SpecialAttackType.KongouNightAttack:
      return '僚艦夜戦突撃';
    default:
      return 'Unknown';
  }
}

/**
 * Format special attack result for display
 */
export function formatSpecialAttackResult(result: SpecialAttackResult): string {
  const lines: string[] = [];

  if (!result.canActivate) {
    lines.push(`Cannot Activate: ${result.reason}`);
    return lines.join('\n');
  }

  lines.push(`Activation Rate: ${result.rate.toFixed(1)}%`);
  lines.push(`Formula: ${result.formula}`);
  lines.push('Components:');
  lines.push(`  Flagship: ${result.breakdown.flagshipComponent.toFixed(2)}`);
  lines.push(`  Partner: ${result.breakdown.partnerComponent.toFixed(2)}`);
  lines.push(`  Luck: ${result.breakdown.luckComponent.toFixed(2)}`);
  lines.push(`  Base: ${result.breakdown.baseComponent}`);

  if (result.breakdown.equipmentBonus > 0) {
    lines.push(`  Equipment: +${result.breakdown.equipmentBonus.toFixed(2)}`);
  }

  return lines.join('\n');
}

// ==================== Example Rate Table ====================

/**
 * Generate example rates for common scenarios
 */
export function generateExampleRates(type: SpecialAttackType): Array<{
  scenario: string;
  rate: number;
}> {
  const examples: Array<{ scenario: string; rate: number }> = [];

  switch (type) {
    case SpecialAttackType.NelsonTouch:
      examples.push({
        scenario: 'Lv99 Nelson (運28) + Lv99 partners',
        rate: quickCalcSpecialAttackRate(type, 99, 28, [99, 99]),
      });
      examples.push({
        scenario: 'Lv180 Nelson (運98) + Lv180 partners',
        rate: quickCalcSpecialAttackRate(type, 180, 98, [180, 180]),
      });
      break;

    case SpecialAttackType.NagatoTouch:
      examples.push({
        scenario: 'Lv99 長門 (運40) + Lv99 陸奥 (運16)',
        rate: quickCalcSpecialAttackRate(type, 99, 40, [99], [16]),
      });
      examples.push({
        scenario: 'Lv130 長門 (運43) + Lv99 陸奥 (運16)',
        rate: quickCalcSpecialAttackRate(type, 130, 43, [99], [16]),
      });
      break;

    default:
      examples.push({
        scenario: 'Lv99 all ships',
        rate: quickCalcSpecialAttackRate(type, 99, 30, [99, 99]),
      });
  }

  return examples;
}
