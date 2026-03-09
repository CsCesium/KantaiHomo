/**
 * Fighter Power Calculator
 *
 * Formula: Fighter Power = Sum[ (AA + Improvement Bonus) * sqrt(SlotSize) + Proficiency Bonus ]
 *
 * Reference: https://wikiwiki.jp/kancolle/航空戦
 */

import { SlotItemEquipType, SlotItemMaster } from '../../../domain/models';

// ==================== Constants ====================

/** Equipment types that participate in air combat */
export const FIGHTER_POWER_EQUIP_TYPES: Set<SlotItemEquipType> = new Set([
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

/** Fighter types (Ace Bonus +22 at max proficiency) */
export const FIGHTER_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.CarrierFighter,   // Carrier-based Fighter
  SlotItemEquipType.SeaplaneFighter,  // Seaplane Fighter
  SlotItemEquipType.Interceptor,      // Land-based Interceptor
]);

/** Seaplane Bomber types (Ace Bonus +6 at max proficiency) */
export const SEAPLANE_BOMBER_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.SeaplaneBomber,   // Seaplane Bomber
]);

/** Attacker/Bomber types (Ace Bonus 0, but has internal proficiency bonus) */
export const ATTACKER_BOMBER_TYPES: Set<SlotItemEquipType> = new Set([
  SlotItemEquipType.CarrierDiveBomber,    // Carrier-based Dive Bomber
  SlotItemEquipType.CarrierTorpedoBomber, // Carrier-based Torpedo Bomber
  SlotItemEquipType.LandAttacker,         // Land-based Attack Aircraft
  SlotItemEquipType.JetFighterBomber,     // Jet Fighter-Bomber
  SlotItemEquipType.JetFighter,           // Jet Fighter
  SlotItemEquipType.JetAttacker,          // Jet Attacker
]);

/** Fighter-Bomber types (Improvement coefficient 0.25) - identified by masterId */
export const BAKUSEN_MASTER_IDS: Set<number> = new Set([
  60,   // Type 0 Fighter Model 62 (Fighter-bomber)
  154,  // Type 0 Fighter Model 62 (Fighter-bomber / Iwai Squadron)
  219,  // Type 0 Fighter Model 63 (Fighter-bomber)
  447,  // Type 0 Fighter Model 64 (Compound)
]);

// ==================== Proficiency Constants ====================

/** Internal proficiency range minimum values by display level (0-7) */
export const PROFICIENCY_INTERNAL_MIN: number[] = [
  0,    // level 0
  10,   // level 1
  25,   // level 2
  40,   // level 3
  55,   // level 4
  70,   // level 5
  80,   // level 6
  100,  // level 7 (MAX)
];

/** Internal proficiency range maximum values by display level (0-7) */
export const PROFICIENCY_INTERNAL_MAX: number[] = [
  9,    // level 0
  24,   // level 1
  39,   // level 2
  54,   // level 3
  69,   // level 4
  79,   // level 5
  99,   // level 6
  120,  // level 7 (MAX)
];

/**
 * Ace Bonus (fixed value) for Fighter types
 * Based on display proficiency level (0-7)
 */
export const FIGHTER_ACE_BONUS: number[] = [
  0,   // level 0
  0,   // level 1
  2,   // level 2
  5,   // level 3
  9,   // level 4
  14,  // level 5
  14,  // level 6
  22,  // level 7 (MAX)
];

/**
 * Ace Bonus (fixed value) for Seaplane Bomber types
 */
export const SEAPLANE_BOMBER_ACE_BONUS: number[] = [
  0,   // level 0
  0,   // level 1
  1,   // level 2
  1,   // level 3
  1,   // level 4
  3,   // level 5
  3,   // level 6
  6,   // level 7 (MAX)
];

// ==================== Air State ====================

export enum AirState {
  /** Air Supremacy */
  Supremacy = 1,
  /** Air Superiority */
  Superiority = 2,
  /** Air Parity */
  Parity = 3,
  /** Air Denial */
  Denial = 4,
  /** Air Incapability */
  Incapability = 5,
}

export const AIR_STATE_NAMES: Record<AirState, string> = {
  [AirState.Supremacy]: 'Air Supremacy',
  [AirState.Superiority]: 'Air Superiority',
  [AirState.Parity]: 'Air Parity',
  [AirState.Denial]: 'Air Denial',
  [AirState.Incapability]: 'Air Incapability',
};

// ==================== Type Definitions ====================

/** Fighter power info for a single equipment slot */
export interface SlotFighterPower {
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
  /** Improvement level */
  level: number;
  /** Proficiency level (0-7) */
  proficiency: number;

  /** Improvement bonus value */
  improvementBonus: number;
  /** Ace bonus (fixed value) */
  aceBonus: number;
  /** Internal proficiency bonus */
  internalProficiencyBonus: number;
  /** Total proficiency bonus */
  totalProficiencyBonus: number;

  /** Fighter power for this slot */
  fighterPower: number;
  /** Minimum fighter power (using min internal proficiency) */
  fighterPowerMin: number;
  /** Maximum fighter power (using max internal proficiency) */
  fighterPowerMax: number;
}

/** Ship fighter power calculation result */
export interface ShipFighterPower {
  /** Ship UID */
  shipUid: number;
  /** Ship name */
  shipName?: string;
  /** Fighter power info for each slot */
  slots: SlotFighterPower[];
  /** Total fighter power for this ship */
  totalFighterPower: number;
  /** Minimum total fighter power */
  totalFighterPowerMin: number;
  /** Maximum total fighter power */
  totalFighterPowerMax: number;
}

/** Fleet fighter power calculation result */
export interface FleetFighterPower {
  /** Fleet/Deck ID */
  deckId: number;
  /** Fighter power info for each ship */
  ships: ShipFighterPower[];
  /** Total fleet fighter power */
  totalFighterPower: number;
  /** Minimum total fighter power */
  totalFighterPowerMin: number;
  /** Maximum total fighter power */
  totalFighterPowerMax: number;
}

/** Air state calculation result */
export interface AirStateResult {
  /** Friendly fighter power */
  friendFighterPower: number;
  /** Enemy fighter power */
  enemyFighterPower: number;
  /** Air state */
  airState: AirState;
  /** Air state name */
  airStateName: string;

  /** Fighter power thresholds for each air state */
  thresholds: {
    /** Required for Air Supremacy */
    supremacy: number;
    /** Required for Air Superiority */
    superiority: number;
    /** Required for Air Parity */
    parity: number;
    /** Required for Air Denial */
    denial: number;
  };
}

// ==================== Core Calculation Functions ====================

/**
 * Check if equipment participates in air combat
 */
export function isAirCombatEquip(equipType: SlotItemEquipType): boolean {
  return FIGHTER_POWER_EQUIP_TYPES.has(equipType);
}

/**
 * Check if equipment is a fighter type (Carrier Fighter/Seaplane Fighter/Interceptor)
 */
export function isFighterType(equipType: SlotItemEquipType): boolean {
  return FIGHTER_TYPES.has(equipType);
}

/**
 * Check if equipment is a Seaplane Bomber
 */
export function isSeaplaneBomber(equipType: SlotItemEquipType): boolean {
  return SEAPLANE_BOMBER_TYPES.has(equipType);
}

/**
 * Check if equipment is a Fighter-Bomber (requires masterId)
 */
export function isBakusen(masterId: number): boolean {
  return BAKUSEN_MASTER_IDS.has(masterId);
}

/**
 * Calculate improvement bonus
 *
 * Fighter/Seaplane Fighter: 0.2 * sqrt(level)
 * Fighter-Bomber: 0.25 * sqrt(level)
 * Others: 0
 */
export function calcImprovementBonus(
  equipType: SlotItemEquipType,
  masterId: number,
  level: number
): number {
  if (level <= 0) return 0;

  const sqrtLevel = Math.sqrt(level);

  // Fighter/Seaplane Fighter
  if (isFighterType(equipType)) {
    return 0.2 * sqrtLevel;
  }

  // Fighter-Bomber
  if (isBakusen(masterId)) {
    return 0.25 * sqrtLevel;
  }

  return 0;
}

/**
 * Get ace bonus (fixed value) based on proficiency level and equipment type
 */
export function getAceBonus(equipType: SlotItemEquipType, proficiency: number): number {
  const level = Math.max(0, Math.min(7, proficiency));

  if (isFighterType(equipType)) {
    return FIGHTER_ACE_BONUS[level];
  }

  if (isSeaplaneBomber(equipType)) {
    return SEAPLANE_BOMBER_ACE_BONUS[level];
  }

  // Attackers/Bombers have no ace bonus
  return 0;
}

/**
 * Calculate internal proficiency bonus
 *
 * Formula: sqrt(internal_proficiency / 10)
 *
 * @param proficiency Display proficiency (0-7)
 * @param useMin Use minimum internal proficiency (conservative calculation)
 */
export function calcInternalProficiencyBonus(
  proficiency: number,
  useMin: boolean = false
): number {
  const level = Math.max(0, Math.min(7, proficiency));
  const internal = useMin
    ? PROFICIENCY_INTERNAL_MIN[level]
    : PROFICIENCY_INTERNAL_MAX[level];

  return Math.sqrt(internal / 10);
}

/**
 * Calculate fighter power for a single equipment slot
 */
export function calcSlotFighterPower(
  master: SlotItemMaster,
  slotSize: number,
  level: number = 0,
  proficiency: number = 0,
): SlotFighterPower {
  const equipType = master.type.equipType;
  const masterId = master.id;
  const baseAA = master.stats.aa;

  // If not air combat equipment or slot size is 0
  if (!isAirCombatEquip(equipType) || slotSize <= 0) {
    return {
      masterId,
      name: master.name,
      equipType,
      slotSize,
      baseAA,
      level,
      proficiency,
      improvementBonus: 0,
      aceBonus: 0,
      internalProficiencyBonus: 0,
      totalProficiencyBonus: 0,
      fighterPower: 0,
      fighterPowerMin: 0,
      fighterPowerMax: 0,
    };
  }

  // Improvement bonus
  const improvementBonus = calcImprovementBonus(equipType, masterId, level);

  // Ace bonus
  const aceBonus = getAceBonus(equipType, proficiency);

  // Internal proficiency bonus (use average)
  const internalBonusMin = calcInternalProficiencyBonus(proficiency, true);
  const internalBonusMax = calcInternalProficiencyBonus(proficiency, false);
  const internalBonus = (internalBonusMin + internalBonusMax) / 2;

  // Total proficiency bonus
  const profBonusMin = aceBonus + internalBonusMin;
  const profBonusMax = aceBonus + internalBonusMax;
  const profBonus = aceBonus + internalBonus;

  // Calculate fighter power
  // Fighter Power = floor[ (AA + Improvement) * sqrt(SlotSize) + Proficiency Bonus ]
  const sqrtSlot = Math.sqrt(slotSize);
  const effectiveAA = baseAA + improvementBonus;

  const fpMin = Math.floor(effectiveAA * sqrtSlot + profBonusMin);
  const fpMax = Math.floor(effectiveAA * sqrtSlot + profBonusMax);
  const fp = Math.floor(effectiveAA * sqrtSlot + profBonus);

  return {
    masterId,
    name: master.name,
    equipType,
    slotSize,
    baseAA,
    level,
    proficiency,
    improvementBonus,
    aceBonus,
    internalProficiencyBonus: internalBonus,
    totalProficiencyBonus: profBonus,
    fighterPower: fp,
    fighterPowerMin: fpMin,
    fighterPowerMax: fpMax,
  };
}

/**
 * Simplified version: calculate fighter power using only numeric values
 */
export function calcFighterPowerSimple(
  aa: number,
  slotSize: number,
  equipType: SlotItemEquipType,
  masterId: number = 0,
  level: number = 0,
  proficiency: number = 7,
): number {
  if (!isAirCombatEquip(equipType) || slotSize <= 0) {
    return 0;
  }

  const improvementBonus = calcImprovementBonus(equipType, masterId, level);
  const aceBonus = getAceBonus(equipType, proficiency);
  const internalBonus = calcInternalProficiencyBonus(proficiency, false);

  const effectiveAA = aa + improvementBonus;
  const sqrtSlot = Math.sqrt(slotSize);

  return Math.floor(effectiveAA * sqrtSlot + aceBonus + internalBonus);
}

// ==================== Air State Determination ====================

/**
 * Determine air state
 *
 * Air Supremacy: friendly >= enemy * 3
 * Air Superiority: friendly >= enemy * 1.5
 * Air Parity: friendly > enemy * 2/3
 * Air Denial: friendly > enemy * 1/3
 * Air Incapability: otherwise
 */
export function determineAirState(friendFP: number, enemyFP: number): AirState {
  if (enemyFP <= 0) {
    return AirState.Supremacy;
  }

  if (friendFP >= enemyFP * 3) {
    return AirState.Supremacy;
  }

  if (friendFP >= enemyFP * 1.5) {
    return AirState.Superiority;
  }

  if (friendFP * 3 > enemyFP * 2) {  // friendFP > enemyFP * 2/3
    return AirState.Parity;
  }

  if (friendFP * 3 > enemyFP) {  // friendFP > enemyFP * 1/3
    return AirState.Denial;
  }

  return AirState.Incapability;
}

/**
 * Calculate fighter power thresholds for each air state
 */
export function calcAirStateThresholds(enemyFP: number): {
  supremacy: number;
  superiority: number;
  parity: number;
  denial: number;
} {
  return {
    supremacy: Math.ceil(enemyFP * 3),      // Air Supremacy
    superiority: Math.ceil(enemyFP * 1.5),  // Air Superiority
    parity: Math.ceil(enemyFP * 2 / 3) + 1, // Air Parity (> 2/3)
    denial: Math.ceil(enemyFP / 3) + 1,     // Air Denial (> 1/3)
  };
}

/**
 * Complete air state calculation
 */
export function calcAirStateResult(friendFP: number, enemyFP: number): AirStateResult {
  const airState = determineAirState(friendFP, enemyFP);

  return {
    friendFighterPower: friendFP,
    enemyFighterPower: enemyFP,
    airState,
    airStateName: AIR_STATE_NAMES[airState],
    thresholds: calcAirStateThresholds(enemyFP),
  };
}

// ==================== Utility Functions ====================

/**
 * Quick calculation for max proficiency carrier fighter
 *
 * Fighter Power = AA * sqrt(SlotSize) + 25
 */
export function calcFighterFPMax(aa: number, slotSize: number): number {
  if (slotSize <= 0) return 0;
  return Math.floor(aa * Math.sqrt(slotSize) + 25);
}

/**
 * Quick calculation for max proficiency seaplane bomber
 *
 * Fighter Power = AA * sqrt(SlotSize) + 9
 */
export function calcSeaplaneBomberFPMax(aa: number, slotSize: number): number {
  if (slotSize <= 0) return 0;
  return Math.floor(aa * Math.sqrt(slotSize) + 9);
}

/**
 * Quick calculation for max proficiency torpedo bomber/dive bomber
 *
 * Fighter Power = AA * sqrt(SlotSize) + sqrt(12)
 */
export function calcAttackerFPMax(aa: number, slotSize: number): number {
  if (slotSize <= 0) return 0;
  return Math.floor(aa * Math.sqrt(slotSize) + Math.sqrt(12));
}
