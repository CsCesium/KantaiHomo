/**
 * Land-Based Air Squadron Fighter Power Calculator
 *
 * Sortie Fighter Power = Sum[ (AA + Improvement + Interception*1.5) * sqrt(SlotSize) + Proficiency Bonus ]
 * Defense Fighter Power = Sum[ (AA + Improvement + Interception + AntiBomber*2) * sqrt(SlotSize) + Proficiency Bonus ] * Recon Bonus
 *
 * Reference: https://wikiwiki.jp/kancolle/基地航空隊
 */

import { SlotItemEquipType, SlotItemMaster } from '../../../domain/models';
import {
  calcInternalProficiencyBonus,
  getAceBonus,
  calcImprovementBonus,
  AirState,
  determineAirState,
} from './fighter_power';

// ==================== Constants ====================

/** Default slot size for LBAS squadrons */
export const LBAS_SLOT_SIZE = 18;

/** Slot size for reconnaissance aircraft */
export const LBAS_RECON_SLOT_SIZE = 4;

/** Slot size for heavy bombers */
export const LBAS_HEAVY_BOMBER_SLOT_SIZE = 9;

/** Equipment types usable in LBAS */
export const LBAS_EQUIP_TYPES: Set<SlotItemEquipType> = new Set([
  // Carrier-based aircraft
  SlotItemEquipType.CarrierFighter,       // Carrier-based Fighter
  SlotItemEquipType.CarrierDiveBomber,    // Carrier-based Dive Bomber
  SlotItemEquipType.CarrierTorpedoBomber, // Carrier-based Torpedo Bomber
  SlotItemEquipType.CarrierRecon,         // Carrier-based Recon

  // Seaplanes
  SlotItemEquipType.SeaplaneRecon,        // Seaplane Recon
  SlotItemEquipType.SeaplaneBomber,       // Seaplane Bomber
  SlotItemEquipType.SeaplaneFighter,      // Seaplane Fighter

  // Land-based aircraft
  SlotItemEquipType.Interceptor,          // Land-based Interceptor
  SlotItemEquipType.LandAttacker,         // Land-based Attack Aircraft
  SlotItemEquipType.LandRecon,            // Land-based Recon
  SlotItemEquipType.HeavyBomber,          // Heavy Bomber

  // Flying boats
  SlotItemEquipType.LargeFlyingBoat,      // Large Flying Boat

  // Jets
  SlotItemEquipType.JetFighter,           // Jet Fighter
  SlotItemEquipType.JetFighterBomber,     // Jet Fighter-Bomber
  SlotItemEquipType.JetAttacker,          // Jet Attacker
]);

/** LBAS equipment types that participate in air combat */
export const LBAS_FIGHTER_POWER_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.CarrierFighter,       // Carrier-based Fighter
  SlotItemEquipType.CarrierDiveBomber,    // Carrier-based Dive Bomber
  SlotItemEquipType.CarrierTorpedoBomber, // Carrier-based Torpedo Bomber
  SlotItemEquipType.CarrierRecon,         // Carrier-based Recon
  SlotItemEquipType.SeaplaneRecon,        // Seaplane Recon
  SlotItemEquipType.SeaplaneBomber,       // Seaplane Bomber
  SlotItemEquipType.SeaplaneFighter,      // Seaplane Fighter
  SlotItemEquipType.Interceptor,          // Land-based Interceptor
  SlotItemEquipType.LandAttacker,         // Land-based Attack Aircraft
  SlotItemEquipType.HeavyBomber,          // Heavy Bomber
  SlotItemEquipType.LargeFlyingBoat,      // Large Flying Boat
  SlotItemEquipType.JetFighter,           // Jet Fighter
  SlotItemEquipType.JetFighterBomber,     // Jet Fighter-Bomber
  SlotItemEquipType.JetAttacker,          // Jet Attacker
]);

/** Interceptor types (have interception/anti-bomber stats) */
export const INTERCEPTOR_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.Interceptor,          // Land-based Interceptor
]);

/** Reconnaissance aircraft types (for defense bonus and range extension) */
export const LBAS_RECON_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.CarrierRecon,         // Carrier-based Recon
  SlotItemEquipType.SeaplaneRecon,        // Seaplane Recon
  SlotItemEquipType.LandRecon,            // Land-based Recon
  SlotItemEquipType.LargeFlyingBoat,      // Large Flying Boat
]);

/** Heavy bomber types */
export const HEAVY_BOMBER_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.HeavyBomber,          // Heavy Bomber
]);

// ==================== Recon Bonus ====================

/** Get the sortie fighter-power multiplier supplied by land-based reconnaissance. */
export function getLbasSortieReconBonus(equipType: SlotItemEquipType, los: number): number {
  if (equipType !== SlotItemEquipType.LandRecon) return 1.0;
  if (los >= 9) return 1.18;
  if (los >= 8) return 1.15;
  return 1.0;
}

/** Get the air-defense fighter-power multiplier supplied by reconnaissance. */
export function getLbasDefenseReconBonus(equipType: SlotItemEquipType, los: number): number {
  if (equipType === SlotItemEquipType.CarrierRecon) {
    return los >= 9 ? 1.30 : 1.20;
  }
  if (equipType === SlotItemEquipType.LandRecon) {
    if (los >= 9) return 1.23;
    if (los >= 8) return 1.18;
    return 1.0;
  }
  if (equipType === SlotItemEquipType.SeaplaneRecon ||
    equipType === SlotItemEquipType.LargeFlyingBoat) {
    if (los >= 9) return 1.16;
    if (los >= 8) return 1.13;
    return 1.10;
  }
  return 1.0;
}

// ==================== Type Definitions ====================

/** LBAS operation mode */
export enum LbasMode {
  /** Standby */
  Standby = 0,
  /** Sortie */
  Sortie = 1,
  /** Air Defense */
  AirDefense = 2,
  /** Retreat */
  Retreat = 3,
  /** Rest */
  Rest = 4,
}

/** Fighter power info for a single squadron */
export interface LbasSquadronFighterPower {
  /** Equipment masterId */
  masterId: number;
  /** Equipment name */
  name?: string;
  /** Equipment type */
  equipType: SlotItemEquipType;
  /** Slot size (aircraft count) */
  slotSize: number;
  /** Base AA value */
  baseAA: number;
  /** Interception value (for interceptors) */
  interception: number;
  /** Anti-bomber value (for interceptors) */
  antiBomber: number;
  /** Line of sight value (for reconnaissance multipliers) */
  los: number;
  /** Improvement level */
  level: number;
  /** Proficiency (0-7) */
  proficiency: number;
  /** Combat radius */
  distance: number;

  /** Sortie fighter power */
  sortieFighterPower: number;
  /** Minimum sortie fighter power */
  sortieFighterPowerMin: number;
  /** Maximum sortie fighter power */
  sortieFighterPowerMax: number;
  /** Defense fighter power (without recon bonus) */
  defenseFighterPower: number;
  /** Minimum defense fighter power (without recon bonus) */
  defenseFighterPowerMin: number;
  /** Maximum defense fighter power (without recon bonus) */
  defenseFighterPowerMax: number;
}

/** Fighter power info for one air corps */
export interface LbasAirCorpsFighterPower {
  /** Air corps ID (1-3) */
  airCorpsId: number;
  /** Air corps name */
  name?: string;
  /** Operation mode */
  mode: LbasMode;
  /** Fighter power info for each squadron */
  squadrons: LbasSquadronFighterPower[];
  /** Combat radius (minimum) */
  distance: number;
  /** Extended combat radius (with recon aircraft) */
  extendedDistance: number;

  /** Total sortie fighter power */
  totalSortieFighterPower: number;
  /** Minimum total sortie fighter power */
  totalSortieFighterPowerMin: number;
  /** Maximum total sortie fighter power */
  totalSortieFighterPowerMax: number;
  /** Total defense fighter power (with recon bonus) */
  totalDefenseFighterPower: number;
  /** Minimum total defense fighter power (with recon bonus) */
  totalDefenseFighterPowerMin: number;
  /** Maximum total defense fighter power (with recon bonus) */
  totalDefenseFighterPowerMax: number;
  /** Recon bonus multiplier */
  reconBonus: number;
  /** Land-based reconnaissance multiplier used on sortie */
  sortieReconBonus: number;
}

/** Fighter power info for all LBAS */
export interface LbasFighterPower {
  /** Fighter power info for each air corps */
  airCorps: LbasAirCorpsFighterPower[];
  /** Total sortie fighter power (all sortie corps) */
  totalSortieFighterPower: number;
  /** Total defense fighter power (all defense corps) */
  totalDefenseFighterPower: number;
}

// ==================== Utility Functions ====================

/**
 * Check if equipment is a recon type
 */
export function isLbasReconType(equipType: SlotItemEquipType): boolean {
  return LBAS_RECON_TYPES.has(equipType);
}

/**
 * Check if equipment is a heavy bomber
 */
export function isHeavyBomber(equipType: SlotItemEquipType): boolean {
  return HEAVY_BOMBER_TYPES.has(equipType);
}

/**
 * Check if equipment is an interceptor
 */
export function isInterceptor(equipType: SlotItemEquipType): boolean {
  return INTERCEPTOR_TYPES.has(equipType);
}

/** api_houk is interception only for land-based fighter/interceptor equipment. */
function getInterception(master: SlotItemMaster): number {
  return isInterceptor(master.type.equipType) ? master.stats.evasion : 0;
}

/** api_houm is anti-bomber only for land-based fighter/interceptor equipment. */
function getAntiBomber(master: SlotItemMaster): number {
  return isInterceptor(master.type.equipType) ? master.stats.hit : 0;
}

/**
 * Get slot size for LBAS equipment
 */
export function getLbasSlotSize(equipType: SlotItemEquipType): number {
  if (isLbasReconType(equipType)) {
    return LBAS_RECON_SLOT_SIZE;
  }
  if (isHeavyBomber(equipType)) {
    return LBAS_HEAVY_BOMBER_SLOT_SIZE;
  }
  return LBAS_SLOT_SIZE;
}

/**
 * Check if equipment participates in LBAS air combat
 */
export function isLbasAirCombatEquip(equipType: SlotItemEquipType): boolean {
  return LBAS_FIGHTER_POWER_TYPES.has(equipType);
}

// ==================== Core Calculation Functions ====================

/**
 * Calculate LBAS sortie fighter power
 *
 * Fighter Power = (AA + Improvement + Interception*1.5) * sqrt(SlotSize) + Proficiency Bonus
 */
export function calcLbasSortieFighterPower(
  master: SlotItemMaster,
  slotSize: number,
  level: number = 0,
  proficiency: number = 7,
): number {
  const equipType = master.type.equipType;

  if (!isLbasAirCombatEquip(equipType) || slotSize <= 0) {
    return 0;
  }

  const baseAA = master.stats.aa;
  const interception = getInterception(master);

  // Improvement bonus
  const improvementBonus = calcImprovementBonus(equipType, master.id, level);

  // Effective AA = AA + Improvement + Interception*1.5
  const effectiveAA = baseAA + improvementBonus + interception * 1.5;

  // Proficiency bonus
  const aceBonus = getAceBonus(equipType, proficiency);
  const internalBonus = calcInternalProficiencyBonus(proficiency, false);
  const profBonus = aceBonus + internalBonus;

  return Math.floor(effectiveAA * Math.sqrt(slotSize) + profBonus);
}

/** Calculate the possible LBAS sortie fighter-power range for a displayed proficiency level. */
export function calcLbasSortieFighterPowerRange(
  master: SlotItemMaster,
  slotSize: number,
  level: number = 0,
  proficiency: number = 7,
): { min: number; max: number } {
  const equipType = master.type.equipType;
  if (!isLbasAirCombatEquip(equipType) || slotSize <= 0) {
    return { min: 0, max: 0 };
  }

  const effectiveAA = master.stats.aa +
    calcImprovementBonus(equipType, master.id, level) +
    getInterception(master) * 1.5;
  const aceBonus = getAceBonus(equipType, proficiency);
  const base = effectiveAA * Math.sqrt(slotSize) + aceBonus;
  return {
    min: Math.floor(base + calcInternalProficiencyBonus(proficiency, true)),
    max: Math.floor(base + calcInternalProficiencyBonus(proficiency, false)),
  };
}

/**
 * Calculate LBAS defense fighter power (without recon bonus)
 *
 * Fighter Power = (AA + Improvement + Interception + AntiBomber*2) * sqrt(SlotSize) + Proficiency Bonus
 */
export function calcLbasDefenseFighterPower(
  master: SlotItemMaster,
  slotSize: number,
  level: number = 0,
  proficiency: number = 7,
): number {
  const equipType = master.type.equipType;

  if (!isLbasAirCombatEquip(equipType) || slotSize <= 0) {
    return 0;
  }

  const baseAA = master.stats.aa;
  const interception = getInterception(master);
  const antiBomber = getAntiBomber(master);

  // Improvement bonus
  const improvementBonus = calcImprovementBonus(equipType, master.id, level);

  // Effective AA = AA + Improvement + Interception + AntiBomber*2
  const effectiveAA = baseAA + improvementBonus + interception + antiBomber * 2;

  // Proficiency bonus
  const aceBonus = getAceBonus(equipType, proficiency);
  const internalBonus = calcInternalProficiencyBonus(proficiency, false);
  const profBonus = aceBonus + internalBonus;

  return Math.floor(effectiveAA * Math.sqrt(slotSize) + profBonus);
}

/** Calculate the possible LBAS defense fighter-power range for a displayed proficiency level. */
export function calcLbasDefenseFighterPowerRange(
  master: SlotItemMaster,
  slotSize: number,
  level: number = 0,
  proficiency: number = 7,
): { min: number; max: number } {
  const equipType = master.type.equipType;
  if (!isLbasAirCombatEquip(equipType) || slotSize <= 0) {
    return { min: 0, max: 0 };
  }

  const effectiveAA = master.stats.aa +
    calcImprovementBonus(equipType, master.id, level) +
    getInterception(master) +
    getAntiBomber(master) * 2;
  const aceBonus = getAceBonus(equipType, proficiency);
  const base = effectiveAA * Math.sqrt(slotSize) + aceBonus;
  return {
    min: Math.floor(base + calcInternalProficiencyBonus(proficiency, true)),
    max: Math.floor(base + calcInternalProficiencyBonus(proficiency, false)),
  };
}

/**
 * Calculate fighter power for a single squadron
 */
export function calcLbasSquadronFighterPower(
  master: SlotItemMaster,
  level: number = 0,
  proficiency: number = 7,
  customSlotSize?: number,
): LbasSquadronFighterPower {
  const equipType = master.type.equipType;
  const slotSize = customSlotSize ?? getLbasSlotSize(equipType);

  const sortieFP = calcLbasSortieFighterPower(master, slotSize, level, proficiency);
  const defenseFP = calcLbasDefenseFighterPower(master, slotSize, level, proficiency);
  const sortieRange = calcLbasSortieFighterPowerRange(master, slotSize, level, proficiency);
  const defenseRange = calcLbasDefenseFighterPowerRange(master, slotSize, level, proficiency);

  return {
    masterId: master.id,
    name: master.name,
    equipType,
    slotSize,
    baseAA: master.stats.aa,
    interception: getInterception(master),
    antiBomber: getAntiBomber(master),
    los: master.stats.los,
    level,
    proficiency,
    distance: master.distance ?? 0,
    sortieFighterPower: sortieFP,
    sortieFighterPowerMin: sortieRange.min,
    sortieFighterPowerMax: sortieRange.max,
    defenseFighterPower: defenseFP,
    defenseFighterPowerMin: defenseRange.min,
    defenseFighterPowerMax: defenseRange.max,
  };
}

// ==================== Combat Radius Calculation ====================

/**
 * Calculate air corps combat radius
 *
 * Extended distance = min distance + min(3, sqrt(max recon distance - min distance))
 */
export function calcLbasDistance(
  squadrons: { distance: number; isRecon: boolean }[]
): { baseDistance: number; extendedDistance: number } {
  if (squadrons.length === 0) {
    return { baseDistance: 0, extendedDistance: 0 };
  }

  // Minimum distance of non-recon aircraft
  const nonReconDistances = squadrons
    .filter(s => !s.isRecon)
    .map(s => s.distance);

  // Maximum distance of recon aircraft
  const reconDistances = squadrons
    .filter(s => s.isRecon)
    .map(s => s.distance);

  if (nonReconDistances.length === 0) {
    // All recon aircraft
    const maxRecon = Math.max(...reconDistances);
    return { baseDistance: maxRecon, extendedDistance: maxRecon };
  }

  const baseDistance = Math.min(...nonReconDistances);

  if (reconDistances.length === 0) {
    // No recon aircraft
    return { baseDistance, extendedDistance: baseDistance };
  }

  const maxReconDistance = Math.max(...reconDistances);

  // Extension = min(3, ceil(sqrt(max recon distance - min distance)))
  const extension = Math.min(3, Math.ceil(Math.sqrt(Math.max(0, maxReconDistance - baseDistance))));

  // Cannot exceed recon aircraft's own range
  const extendedDistance = Math.min(baseDistance + extension, maxReconDistance);

  return { baseDistance, extendedDistance };
}

// ==================== Air Corps Calculation ====================

/**
 * Calculate fighter power for one air corps
 */
export function calcLbasAirCorpsFighterPower(
  airCorpsId: number,
  squadrons: LbasSquadronFighterPower[],
  mode: LbasMode = LbasMode.Sortie,
  name?: string,
): LbasAirCorpsFighterPower {
  // Calculate combat radius
  const distanceInfo = calcLbasDistance(
    squadrons.map(s => ({
      distance: s.distance,
      isRecon: isLbasReconType(s.equipType),
    }))
  );

  // Find the strongest applicable reconnaissance multiplier.
  let maxSortieReconBonus = 1.0;
  let maxDefenseReconBonus = 1.0;
  for (const squadron of squadrons) {
    if (squadron.slotSize > 0 && isLbasReconType(squadron.equipType)) {
      const sortieBonus = getLbasSortieReconBonus(squadron.equipType, squadron.los);
      const defenseBonus = getLbasDefenseReconBonus(squadron.equipType, squadron.los);
      if (sortieBonus > maxSortieReconBonus) {
        maxSortieReconBonus = sortieBonus;
      }
      if (defenseBonus > maxDefenseReconBonus) {
        maxDefenseReconBonus = defenseBonus;
      }
    }
  }

  // Calculate total fighter power
  let totalSortie = 0;
  let totalSortieMin = 0;
  let totalSortieMax = 0;
  let totalDefense = 0;
  let totalDefenseMin = 0;
  let totalDefenseMax = 0;

  for (const squadron of squadrons) {
    totalSortie += squadron.sortieFighterPower;
    totalSortieMin += squadron.sortieFighterPowerMin;
    totalSortieMax += squadron.sortieFighterPowerMax;
    totalDefense += squadron.defenseFighterPower;
    totalDefenseMin += squadron.defenseFighterPowerMin;
    totalDefenseMax += squadron.defenseFighterPowerMax;
  }

  // Apply reconnaissance multipliers after summing and flooring each squadron.
  totalSortie = Math.floor(totalSortie * maxSortieReconBonus);
  totalSortieMin = Math.floor(totalSortieMin * maxSortieReconBonus);
  totalSortieMax = Math.floor(totalSortieMax * maxSortieReconBonus);
  totalDefense = Math.floor(totalDefense * maxDefenseReconBonus);
  totalDefenseMin = Math.floor(totalDefenseMin * maxDefenseReconBonus);
  totalDefenseMax = Math.floor(totalDefenseMax * maxDefenseReconBonus);

  return {
    airCorpsId,
    name,
    mode,
    squadrons,
    distance: distanceInfo.baseDistance,
    extendedDistance: distanceInfo.extendedDistance,
    totalSortieFighterPower: totalSortie,
    totalSortieFighterPowerMin: totalSortieMin,
    totalSortieFighterPowerMax: totalSortieMax,
    totalDefenseFighterPower: totalDefense,
    totalDefenseFighterPowerMin: totalDefenseMin,
    totalDefenseFighterPowerMax: totalDefenseMax,
    reconBonus: maxDefenseReconBonus,
    sortieReconBonus: maxSortieReconBonus,
  };
}

// ==================== Utility Functions ====================

/**
 * Quick calculation for max proficiency interceptor sortie fighter power
 *
 * Fighter Power = (AA + Interception*1.5) * sqrt(18) + 25
 */
export function calcInterceptorSortieFPMax(
  aa: number,
  interception: number,
  slotSize: number = LBAS_SLOT_SIZE
): number {
  if (slotSize <= 0) return 0;
  const effectiveAA = aa + interception * 1.5;
  return Math.floor(effectiveAA * Math.sqrt(slotSize) + 25);
}

/**
 * Quick calculation for max proficiency interceptor defense fighter power
 *
 * Fighter Power = (AA + Interception + AntiBomber*2) * sqrt(18) + 25
 */
export function calcInterceptorDefenseFPMax(
  aa: number,
  interception: number,
  antiBomber: number,
  slotSize: number = LBAS_SLOT_SIZE
): number {
  if (slotSize <= 0) return 0;
  const effectiveAA = aa + interception + antiBomber * 2;
  return Math.floor(effectiveAA * Math.sqrt(slotSize) + 25);
}

/**
 * Quick calculation for max proficiency land attacker fighter power (same for sortie/defense)
 *
 * Fighter Power = AA * sqrt(18) + sqrt(12)
 */
export function calcLandAttackerFPMax(
  aa: number,
  slotSize: number = LBAS_SLOT_SIZE
): number {
  if (slotSize <= 0) return 0;
  return Math.floor(aa * Math.sqrt(slotSize) + Math.sqrt(12));
}

/**
 * Determine LBAS air state against enemy
 */
export function determineLbasAirState(lbasFP: number, enemyFP: number): AirState {
  return determineAirState(lbasFP, enemyFP);
}

// ==================== Common Recon Bonus Reference ====================

/** Common reconnaissance aircraft defense bonuses */
export const COMMON_RECON_BONUS = {
  /** Saiun */
  SAIUN: { masterId: 54, bonus: 1.30 },
  /** Type 2 Carrier Recon */
  TYPE_2_RECON: { masterId: 61, bonus: 1.20 },
  /** Type 2 Land-based Recon */
  TYPE_2_LAND_RECON: { masterId: 311, bonus: 1.18 },
  /** Type 2 Land-based Recon (Skilled) */
  TYPE_2_LAND_RECON_SKILLED: { masterId: 312, bonus: 1.23 },
  /** Prototype Keiun (Carrier Recon) */
  PROTOTYPE_KEIUN: { masterId: 151, bonus: 1.30 },
  /** Type 2 Flying Boat */
  TYPE_2_FLYING_BOAT: { masterId: 138, bonus: 1.16 },
  /** PBY-5A Catalina */
  PBY_CATALINA: { masterId: 178, bonus: 1.16 },
};
