/**
 * Night Battle Cut-In (夜戦カットイン) Activation Rate Calculator
 *
 * Calculates the activation rate of various night battle cut-in attacks.
 *
 * Formula:
 *   CI項(運50未満) = 15 + 運 + floor(0.75 × √Lv) + 各種補正
 *   CI項(運50以上) = 65 + floor(√(運-50)) + floor(0.8 × √Lv) + 各種補正
 *
 *   発動率 = (CI項 / 種別係数) × 100 [%]
 *
 * 各種補正:
 *   - 旗艦補正: +15
 *   - 中破補正: +18
 *   - 探照灯: +7 (to fleet)
 *   - 照明弾: +4 (to fleet)
 *   - 熟練見張員: +5 (self only)
 *   - 水雷見張員/電探: varies
 *
 * Reference: https://wikiwiki.jp/kancolle/夜戦
 */

import {
  ShipPosition,
  DamageState,
  isFlagship,
  clampRate,
  RATE_CAP,
} from './rate_types';

// ==================== Cut-In Types ====================

/**
 * Night battle cut-in type
 */
export enum NightCutInType {
  /** 魚雷カットイン (魚魚魚/魚魚) - Torpedo CI */
  TorpedoCI = 'torpedo_ci',
  /** 主魚電カットイン - Main+Torpedo+Radar CI (DD only) */
  MainTorpRadarCI = 'main_torp_radar_ci',
  /** 魚魚主カットイン - Torp+Torp+Main CI (DD only) */
  TorpTorpMainCI = 'torp_torp_main_ci',
  /** 魚魚水カットイン - Torp+Torp+Lookout CI (DD only) */
  TorpTorpLookoutCI = 'torp_torp_lookout_ci',
  /** 主砲カットイン (主主主/主主副) - Main Gun CI */
  MainGunCI = 'main_gun_ci',
  /** 主副カットイン - Main+Secondary CI */
  MainSecondaryCI = 'main_secondary_ci',
  /** 砲雷カットイン - Main+Torpedo CI */
  MainTorpCI = 'main_torp_ci',
  /** 連撃 - Double Attack */
  DoubleAttack = 'double_attack',
  /** 空母夜襲カットイン - Carrier Night CI */
  CarrierNightCI = 'carrier_night_ci',
  /** 潜水艦カットイン - Submarine CI */
  SubmarineCI = 'submarine_ci',
}

/**
 * Cut-in type coefficient (種別係数)
 * Lower coefficient = higher activation rate
 */
export const CUTIN_TYPE_COEFFICIENT: Record<NightCutInType, number> = {
  [NightCutInType.TorpedoCI]: 1.0,
  [NightCutInType.MainTorpRadarCI]: 0.94, // ~1/1.06
  [NightCutInType.TorpTorpMainCI]: 1.0,
  [NightCutInType.TorpTorpLookoutCI]: 1.0, // Estimate
  [NightCutInType.MainGunCI]: 1.15,
  [NightCutInType.MainSecondaryCI]: 1.06,
  [NightCutInType.MainTorpCI]: 0.94,
  [NightCutInType.DoubleAttack]: 0.5, // Very high rate (simplified)
  [NightCutInType.CarrierNightCI]: 1.0, // Estimate
  [NightCutInType.SubmarineCI]: 1.0, // Estimate
};

// ==================== Equipment Bonuses ====================

/**
 * Night battle equipment type
 */
export enum NightEquipmentType {
  /** 探照灯 - Searchlight */
  Searchlight = 'searchlight',
  /** 大型探照灯 - Large Searchlight */
  LargeSearchlight = 'large_searchlight',
  /** 照明弾 - Star Shell */
  StarShell = 'star_shell',
  /** 熟練見張員 - Skilled Lookout */
  SkilledLookout = 'skilled_lookout',
  /** 水雷見張員 - Surface Radar Lookout */
  SurfaceRadarLookout = 'surface_radar_lookout',
  /** 夜偵 - Night Recon */
  NightRecon = 'night_recon',
}

/**
 * Fleet-wide equipment bonus to cut-in rate
 */
export interface FleetEquipBonus {
  /** 探照灯発動 - Searchlight activated */
  searchlightActive: boolean;
  /** 照明弾発動 - Star Shell activated */
  starShellActive: boolean;
  /** 夜偵発動 - Night Recon activated */
  nightReconActive: boolean;
}

/**
 * Ship-specific equipment bonus
 */
export interface ShipEquipBonus {
  /** Has skilled lookout (熟練見張員) */
  hasSkilledLookout: boolean;
  /** Has surface radar lookout (水雷見張員) */
  hasSurfaceRadarLookout: boolean;
  /** Has LoS 5+ radar in expansion slot (for 主魚電) */
  hasLoS5RadarExpansion: boolean;
  /** D-gun (駆逐主砲) bonus count */
  dGunCount: number;
}

// ==================== Bonus Constants ====================

/** Flagship position bonus */
export const FLAGSHIP_BONUS = 15;

/** Chuuha (moderate damage) bonus */
export const CHUUHA_BONUS = 18;

/** Searchlight bonus (fleet-wide) */
export const SEARCHLIGHT_BONUS = 7;

/** Star shell bonus (fleet-wide) */
export const STAR_SHELL_BONUS = 4;

/** Skilled lookout bonus (self only, subject to luck cap pre-2024) */
export const SKILLED_LOOKOUT_BONUS = 5;

/** Surface radar lookout bonus */
export const SURFACE_RADAR_LOOKOUT_BONUS = 4;

/** Luck cap threshold */
export const LUCK_CAP = 50;

// ==================== CI Term Calculation ====================

/**
 * Calculate CI term (CI項)
 *
 * Formula:
 *   運50未満: 15 + 運 + floor(0.75 × √Lv)
 *   運50以上: 65 + floor(√(運-50)) + floor(0.8 × √Lv)
 */
export function calcCITerm(luck: number, level: number): number {
  if (luck < LUCK_CAP) {
    // Under luck cap
    return 15 + luck + Math.floor(0.75 * Math.sqrt(level));
  } else {
    // Over luck cap - diminishing returns
    return 65 + Math.floor(Math.sqrt(luck - LUCK_CAP)) + Math.floor(0.8 * Math.sqrt(level));
  }
}

/**
 * Calculate position bonus
 */
export function calcPositionBonus(position: ShipPosition): number {
  return isFlagship(position) ? FLAGSHIP_BONUS : 0;
}

/**
 * Calculate damage state bonus
 */
export function calcDamageBonus(damageState: DamageState): number {
  return damageState === DamageState.Chuuha ? CHUUHA_BONUS : 0;
}

/**
 * Calculate fleet equipment bonus
 */
export function calcFleetEquipBonus(fleetBonus: FleetEquipBonus): number {
  let bonus = 0;

  if (fleetBonus.searchlightActive) {
    bonus += SEARCHLIGHT_BONUS;
  }
  if (fleetBonus.starShellActive) {
    bonus += STAR_SHELL_BONUS;
  }
  // Night recon does NOT affect cut-in rate, only damage/accuracy

  return bonus;
}

/**
 * Calculate ship equipment bonus
 */
export function calcShipEquipBonus(shipBonus: ShipEquipBonus): number {
  let bonus = 0;

  if (shipBonus.hasSkilledLookout) {
    bonus += SKILLED_LOOKOUT_BONUS;
  }
  if (shipBonus.hasSurfaceRadarLookout) {
    bonus += SURFACE_RADAR_LOOKOUT_BONUS;
  }

  return bonus;
}

// ==================== Cut-In Rate Calculation ====================

/**
 * Night cut-in calculation input
 */
export interface NightCutInInput {
  /** Ship luck stat */
  luck: number;
  /** Ship level */
  level: number;
  /** Ship position in fleet */
  position: ShipPosition;
  /** Ship damage state */
  damageState: DamageState;
  /** Cut-in type */
  cutInType: NightCutInType;
  /** Fleet equipment bonuses */
  fleetBonus: FleetEquipBonus;
  /** Ship equipment bonuses */
  shipBonus: ShipEquipBonus;
}

/**
 * Night cut-in calculation result
 */
export interface NightCutInResult {
  /** Final activation rate (%) */
  rate: number;
  /** CI term before division */
  ciTerm: number;
  /** Type coefficient */
  typeCoefficient: number;
  /** Breakdown of bonuses */
  breakdown: {
    baseTerm: number;
    positionBonus: number;
    damageBonus: number;
    fleetEquipBonus: number;
    shipEquipBonus: number;
    totalBonus: number;
  };
}

/**
 * Calculate night cut-in activation rate
 */
export function calcNightCutInRate(input: NightCutInInput): NightCutInResult {
  // Cannot activate if heavily damaged or sunk
  if (input.damageState === DamageState.Taiha || input.damageState === DamageState.Sunk) {
    return {
      rate: 0,
      ciTerm: 0,
      typeCoefficient: 1,
      breakdown: {
        baseTerm: 0,
        positionBonus: 0,
        damageBonus: 0,
        fleetEquipBonus: 0,
        shipEquipBonus: 0,
        totalBonus: 0,
      },
    };
  }

  // Calculate base CI term
  const baseTerm = calcCITerm(input.luck, input.level);

  // Calculate bonuses
  const positionBonus = calcPositionBonus(input.position);
  const damageBonus = calcDamageBonus(input.damageState);
  const fleetEquipBonus = calcFleetEquipBonus(input.fleetBonus);
  const shipEquipBonus = calcShipEquipBonus(input.shipBonus);
  const totalBonus = positionBonus + damageBonus + fleetEquipBonus + shipEquipBonus;

  // Total CI term
  const ciTerm = baseTerm + totalBonus;

  // Get type coefficient
  const typeCoefficient = CUTIN_TYPE_COEFFICIENT[input.cutInType];

  // Calculate rate
  const rawRate = (ciTerm / typeCoefficient);
  const rate = clampRate(rawRate, RATE_CAP);

  return {
    rate,
    ciTerm,
    typeCoefficient,
    breakdown: {
      baseTerm,
      positionBonus,
      damageBonus,
      fleetEquipBonus,
      shipEquipBonus,
      totalBonus,
    },
  };
}

// ==================== Simplified Calculation ====================

/**
 * Quick calculation of night cut-in rate
 *
 * @param luck Ship luck
 * @param level Ship level
 * @param cutInType Cut-in type
 * @param isFlagship Whether ship is flagship
 * @param isChuuha Whether ship is moderately damaged
 * @param searchlight Whether searchlight is active
 * @param starShell Whether star shell is active
 */
export function quickCalcNightCutInRate(
  luck: number,
  level: number,
  cutInType: NightCutInType,
  isFlagship: boolean = false,
  isChuuha: boolean = false,
  searchlight: boolean = false,
  starShell: boolean = false,
): number {
  const result = calcNightCutInRate({
    luck,
    level,
    position: isFlagship ? ShipPosition.Flagship : ShipPosition.Second,
    damageState: isChuuha ? DamageState.Chuuha : DamageState.Normal,
    cutInType,
    fleetBonus: {
      searchlightActive: searchlight,
      starShellActive: starShell,
      nightReconActive: false,
    },
    shipBonus: {
      hasSkilledLookout: false,
      hasSurfaceRadarLookout: false,
      hasLoS5RadarExpansion: false,
      dGunCount: 0,
    },
  });

  return result.rate;
}

// ==================== Rate Lookup Table ====================

/**
 * Generate cut-in rate lookup table
 *
 * @param cutInType Cut-in type
 * @param level Ship level (default 99)
 * @param isFlagship Whether flagship
 */
export function generateCutInRateTable(
  cutInType: NightCutInType,
  level: number = 99,
  isFlagship: boolean = false,
): Map<number, number> {
  const table = new Map<number, number>();

  for (let luck = 0; luck <= 100; luck += 5) {
    const rate = quickCalcNightCutInRate(luck, level, cutInType, isFlagship);
    table.set(luck, rate);
  }

  return table;
}

/**
 * Calculate required luck for target rate
 */
export function calcRequiredLuckForRate(
  targetRate: number,
  level: number,
  cutInType: NightCutInType,
  isFlagship: boolean = false,
): number | null {
  // Binary search for required luck
  let low = 0;
  let high = 200;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const rate = quickCalcNightCutInRate(mid, level, cutInType, isFlagship);

    if (rate >= targetRate) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  // Verify result
  const finalRate = quickCalcNightCutInRate(low, level, cutInType, isFlagship);
  if (finalRate >= targetRate) {
    return low;
  }

  return null; // Cannot achieve target rate
}

// ==================== Display Helpers ====================

/**
 * Format night cut-in result for display
 */
export function formatNightCutInResult(result: NightCutInResult): string {
  const lines: string[] = [];

  lines.push(`Cut-In Rate: ${result.rate.toFixed(1)}%`);
  lines.push(`CI Term: ${result.ciTerm} / ${result.typeCoefficient.toFixed(2)}`);
  lines.push('Breakdown:');
  lines.push(`  Base: ${result.breakdown.baseTerm}`);

  if (result.breakdown.positionBonus > 0) {
    lines.push(`  Flagship: +${result.breakdown.positionBonus}`);
  }
  if (result.breakdown.damageBonus > 0) {
    lines.push(`  Chuuha: +${result.breakdown.damageBonus}`);
  }
  if (result.breakdown.fleetEquipBonus > 0) {
    lines.push(`  Fleet Equip: +${result.breakdown.fleetEquipBonus}`);
  }
  if (result.breakdown.shipEquipBonus > 0) {
    lines.push(`  Ship Equip: +${result.breakdown.shipEquipBonus}`);
  }

  return lines.join('\n');
}

/**
 * Get cut-in type display name
 */
export function getCutInTypeName(type: NightCutInType): string {
  switch (type) {
    case NightCutInType.TorpedoCI:
      return '魚雷カットイン';
    case NightCutInType.MainTorpRadarCI:
      return '主魚電カットイン';
    case NightCutInType.TorpTorpMainCI:
      return '魚魚主カットイン';
    case NightCutInType.TorpTorpLookoutCI:
      return '魚魚水カットイン';
    case NightCutInType.MainGunCI:
      return '主砲カットイン';
    case NightCutInType.MainSecondaryCI:
      return '主副カットイン';
    case NightCutInType.MainTorpCI:
      return '砲雷カットイン';
    case NightCutInType.DoubleAttack:
      return '連撃';
    case NightCutInType.CarrierNightCI:
      return '夜襲カットイン';
    case NightCutInType.SubmarineCI:
      return '潜水艦カットイン';
    default:
      return 'Unknown';
  }
}
