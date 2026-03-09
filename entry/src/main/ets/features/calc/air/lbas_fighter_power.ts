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
  SlotItemEquipType.SeaplaneBomber,       // Seaplane Bomber
  SlotItemEquipType.SeaplaneFighter,      // Seaplane Fighter
  SlotItemEquipType.Interceptor,          // Land-based Interceptor
  SlotItemEquipType.LandAttacker,         // Land-based Attack Aircraft
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

// ==================== Defense Recon Bonus ====================

/** Defense mode recon bonus multipliers (masterId -> multiplier) */
export const LBAS_RECON_BONUS_MAP: Map<number, number> = new Map([
  // Saiun series
  [54, 1.30],   // Saiun
  [316, 1.24], // Saiun (4th Recon Squad)

  // Type 2 Carrier Recon series
  [61, 1.20],   // Type 2 Carrier Recon

  // Prototype Keiun
  [151, 1.24], // Prototype Keiun (Carrier Recon)

  // Type 2 Land-based Recon series
  [311, 1.18], // Type 2 Land-based Recon
  [312, 1.24], // Type 2 Land-based Recon (Skilled)

  // Seaplane Recon series
  [25, 1.10],  // Type 0 Recon Seaplane
  [59, 1.13],  // Type 0 Observation Seaplane
  [163, 1.16], // Ro.43 Recon Seaplane
  [118, 1.16], // Shiun

  // Large Flying Boats
  [138, 1.18], // Type 2 Flying Boat
  [178, 1.15], // PBY-5A Catalina
]);

/** Get defense recon bonus multiplier */
export function getLbasReconBonus(masterId: number): number {
  return LBAS_RECON_BONUS_MAP.get(masterId) ?? 1.0;
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
  /** Improvement level */
  level: number;
  /** Proficiency (0-7) */
  proficiency: number;
  /** Combat radius */
  distance: number;

  /** Sortie fighter power */
  sortieFighterPower: number;
  /** Defense fighter power (without recon bonus) */
  defenseFighterPower: number;
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
  /** Total defense fighter power (with recon bonus) */
  totalDefenseFighterPower: number;
  /** Recon bonus multiplier */
  reconBonus: number;
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
  const interception = master.stats.evasion; // Interception stat

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
  const interception = master.stats.evasion; // Interception stat
  const antiBomber = master.stats.hit;       // Anti-bomber stat

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

  return {
    masterId: master.id,
    name: master.name,
    equipType,
    slotSize,
    baseAA: master.stats.aa,
    interception: master.stats.evasion,
    antiBomber: master.stats.hit,
    level,
    proficiency,
    distance: master.distance ?? 0,
    sortieFighterPower: sortieFP,
    defenseFighterPower: defenseFP,
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

  // Find max recon bonus
  let maxReconBonus = 1.0;
  for (const squadron of squadrons) {
    if (isLbasReconType(squadron.equipType)) {
      const bonus = getLbasReconBonus(squadron.masterId);
      if (bonus > maxReconBonus) {
        maxReconBonus = bonus;
      }
    }
  }

  // Calculate total fighter power
  let totalSortie = 0;
  let totalDefense = 0;

  for (const squadron of squadrons) {
    totalSortie += squadron.sortieFighterPower;
    totalDefense += squadron.defenseFighterPower;
  }

  // Apply recon bonus to defense
  totalDefense = Math.floor(totalDefense * maxReconBonus);

  return {
    airCorpsId,
    name,
    mode,
    squadrons,
    distance: distanceInfo.baseDistance,
    extendedDistance: distanceInfo.extendedDistance,
    totalSortieFighterPower: totalSortie,
    totalDefenseFighterPower: totalDefense,
    reconBonus: maxReconBonus,
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
  TYPE_2_LAND_RECON_SKILLED: { masterId: 312, bonus: 1.24 },
  /** Prototype Keiun (Carrier Recon) */
  PROTOTYPE_KEIUN: { masterId: 151, bonus: 1.24 },
  /** Type 2 Flying Boat */
  TYPE_2_FLYING_BOAT: { masterId: 138, bonus: 1.18 },
  /** PBY-5A Catalina */
  PBY_CATALINA: { masterId: 178, bonus: 1.15 },
};
