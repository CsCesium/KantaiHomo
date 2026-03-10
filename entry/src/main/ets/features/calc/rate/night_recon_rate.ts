/**
 * Night Reconnaissance (夜間触接) Activation Rate Calculator
 *
 * Night recon activates during night battle when conditions are met,
 * providing attack power bonus and accuracy bonus to the entire fleet.
 *
 * Formula: rate = √(equip_los × ship_level) × 4 [%]
 * Alternative: rate = √(50 × ship_level) - 3 [%] (for LOS 3 equipment)
 *
 * Activation conditions:
 * - Air state: Supremacy, Superiority, or Denial (not Parity/Incapability)
 * - Slot count > 0 for the slot carrying night recon
 * - Ship not heavily damaged or sunk
 *
 * Effects when activated:
 * - Fleet accuracy +10% (does not reach 100%)
 * - Base attack power +5/+7 (depends on equipment)
 * - Critical rate bonus (estimated)
 *
 * Reference: https://wikiwiki.jp/kancolle/九八式水上偵察機(夜偵)
 */

import {
  AirState,
  DamageState,
  allowsNightRecon,
  clampRate,
  combinedSuccessRate,
  MAX_RATE,
} from './rate_types';

// ==================== Night Recon Equipment Data ====================

/**
 * Night reconnaissance equipment info
 */
export interface NightReconEquipInfo {
  /** Equipment master ID */
  masterId: number;
  /** Equipment name */
  name: string;
  /** Equipment LoS value */
  los: number;
  /** Accuracy value */
  accuracy: number;
  /** Attack power bonus when activated */
  attackBonus: number;
  /** Accuracy multiplier when activated */
  accuracyMultiplier: number;
}

/**
 * Known night recon equipment
 */
export const NIGHT_RECON_EQUIPMENT: Map<number, NightReconEquipInfo> = new Map([
  [102, {
    masterId: 102,
    name: '九八式水上偵察機(夜偵)',
    los: 3,
    accuracy: 1,
    attackBonus: 5,
    accuracyMultiplier: 1.1,
  }],
  [312, {
    masterId: 312,
    name: '零式水上偵察機11型乙改(夜偵)',
    los: 5,
    accuracy: 2,
    attackBonus: 7,
    accuracyMultiplier: 1.15,
  }],
  [262, {
    masterId: 262,
    name: 'Loire 130M',
    los: 4,
    accuracy: 1,
    attackBonus: 7,
    accuracyMultiplier: 1.1,
  }],
  [471, {
    masterId: 471,
    name: 'Loire 130M改(熟練)',
    los: 5,
    accuracy: 3,
    attackBonus: 9,
    accuracyMultiplier: 1.15,
  }],
  [304, {
    masterId: 304,
    name: 'Walrus',
    los: 4,
    accuracy: 1,
    attackBonus: 7,
    accuracyMultiplier: 1.1,
  }],
  [370, {
    masterId: 370,
    name: 'Sea Otter',
    los: 4,
    accuracy: 2,
    attackBonus: 7,
    accuracyMultiplier: 1.15,
  }],
  [509, {
    masterId: 509,
    name: '零式水上偵察機11型甲改二',
    los: 9,
    accuracy: 3,
    attackBonus: 9,
    accuracyMultiplier: 1.15,
  }],
]);

/**
 * Check if equipment is a night recon
 */
export function isNightReconEquipment(masterId: number): boolean {
  return NIGHT_RECON_EQUIPMENT.has(masterId);
}

/**
 * Get night recon equipment info
 */
export function getNightReconInfo(masterId: number): NightReconEquipInfo | undefined {
  return NIGHT_RECON_EQUIPMENT.get(masterId);
}

// ==================== Rate Calculation ====================

/**
 * Calculate night recon activation rate for a single equipment
 *
 * Formula: rate = √(equip_los × ship_level) × 4 [%]
 *
 * @param los Equipment LoS value
 * @param shipLevel Ship level (1-180)
 * @returns Activation rate in percentage (0-100)
 */
export function calcNightReconRate(los: number, shipLevel: number): number {
  if (los <= 0 || shipLevel <= 0) return 0;

  const rate = Math.sqrt(los * shipLevel) * 4;
  return clampRate(rate, MAX_RATE);
}

/**
 * Calculate night recon rate using equipment master ID
 */
export function calcNightReconRateByEquip(
  masterId: number,
  shipLevel: number,
): number {
  const info = getNightReconInfo(masterId);
  if (!info) return 0;

  return calcNightReconRate(info.los, shipLevel);
}

/**
 * Night recon slot info for calculation
 */
export interface NightReconSlot {
  /** Equipment master ID */
  masterId: number;
  /** Current slot count */
  slotCount: number;
}

/**
 * Ship night recon calculation input
 */
export interface ShipNightReconInput {
  /** Ship level */
  level: number;
  /** Ship damage state */
  damageState: DamageState;
  /** Night recon slots (only slots with night recon equipment) */
  nightReconSlots: NightReconSlot[];
}

/**
 * Calculate night recon activation rate for a ship
 * Multiple night recons on the same ship each trigger their own roll
 *
 * @param input Ship night recon input
 * @returns Combined activation rate
 */
export function calcShipNightReconRate(input: ShipNightReconInput): number {
  // Cannot activate if heavily damaged or sunk
  if (input.damageState === DamageState.Taiha || input.damageState === DamageState.Sunk) {
    return 0;
  }

  const rates: number[] = [];

  for (const slot of input.nightReconSlots) {
    // Slot must have at least 1 plane
    if (slot.slotCount <= 0) continue;

    const rate = calcNightReconRateByEquip(slot.masterId, input.level);
    if (rate > 0) {
      rates.push(rate);
    }
  }

  if (rates.length === 0) return 0;

  // Combined rate: 1 - (1-p1)(1-p2)...
  return combinedSuccessRate(rates);
}

// ==================== Fleet Calculation ====================

/**
 * Fleet night recon calculation result
 */
export interface FleetNightReconResult {
  /** Overall activation rate */
  rate: number;
  /** Individual ship rates */
  shipRates: Array<{
    shipIndex: number;
    rate: number;
    equipmentCount: number;
  }>;
  /** Best equipment info (highest attack bonus) */
  bestEquipment?: NightReconEquipInfo;
  /** Air state requirement met */
  airStateValid: boolean;
}

/**
 * Calculate fleet night recon activation rate
 *
 * Note: Multiple ships with night recon - verification incomplete
 * Current assumption: Each ship triggers independently
 *
 * @param ships Array of ship night recon inputs
 * @param airState Current air state
 * @param isExercise Whether this is an exercise (演習)
 */
export function calcFleetNightReconRate(
  ships: ShipNightReconInput[],
  airState: AirState,
  isExercise: boolean = false,
): FleetNightReconResult {
  const airStateValid = allowsNightRecon(airState, isExercise);

  if (!airStateValid) {
    return {
      rate: 0,
      shipRates: [],
      airStateValid: false,
    };
  }

  const shipRates: FleetNightReconResult['shipRates'] = [];
  const allRates: number[] = [];
  let bestEquipment: NightReconEquipInfo | undefined;

  ships.forEach((ship, index) => {
    const rate = calcShipNightReconRate(ship);

    if (rate > 0) {
      shipRates.push({
        shipIndex: index,
        rate,
        equipmentCount: ship.nightReconSlots.filter(s => s.slotCount > 0).length,
      });
      allRates.push(rate);

      // Track best equipment for effect display
      for (const slot of ship.nightReconSlots) {
        if (slot.slotCount > 0) {
          const info = getNightReconInfo(slot.masterId);
          if (info && (!bestEquipment || info.attackBonus > bestEquipment.attackBonus)) {
            bestEquipment = info;
          }
        }
      }
    }
  });

  return {
    rate: combinedSuccessRate(allRates),
    shipRates,
    bestEquipment,
    airStateValid: true,
  };
}

// ==================== Utility Functions ====================

/**
 * Calculate required level for 100% activation rate
 *
 * Formula: rate = √(los × level) × 4 = 100
 * => level = (100/4)² / los = 625 / los
 */
export function calcLevelFor100Percent(los: number): number {
  if (los <= 0) return Infinity;
  return Math.ceil(625 / los);
}

/**
 * Get level requirements for 100% activation by equipment
 */
export function getLevelRequirementsFor100(): Map<number, number> {
  const requirements = new Map<number, number>();

  for (const [masterId, info] of NIGHT_RECON_EQUIPMENT) {
    const level = calcLevelFor100Percent(info.los);
    requirements.set(masterId, level);
  }

  return requirements;
}

/**
 * Level thresholds for 100% night recon activation
 * - LOS 3: Cannot reach 100% (requires Lv.209)
 * - LOS 4: Lv.157+
 * - LOS 5: Lv.125+
 * - LOS 9: Lv.70+
 */
export const NIGHT_RECON_100_LEVELS: Record<number, number> = {
  3: 209, // Impossible with Lv.180 cap
  4: 157,
  5: 125,
  6: 105,
  7: 90,
  8: 79,
  9: 70,
};

/**
 * Check if ship can achieve 100% night recon rate
 */
export function canAchieve100Percent(los: number, shipLevel: number): boolean {
  return shipLevel >= calcLevelFor100Percent(los);
}

/**
 * Format night recon rate result for display
 */
export function formatNightReconResult(result: FleetNightReconResult): string {
  const lines: string[] = [];

  if (!result.airStateValid) {
    lines.push('Night Recon: Cannot activate (air state)');
    return lines.join('\n');
  }

  lines.push(`Night Recon Rate: ${result.rate.toFixed(1)}%`);

  if (result.bestEquipment) {
    lines.push(`Effect: Attack +${result.bestEquipment.attackBonus}`);
  }

  for (const ship of result.shipRates) {
    lines.push(`  Ship ${ship.shipIndex + 1}: ${ship.rate.toFixed(1)}% (${ship.equipmentCount} equip)`);
  }

  return lines.join('\n');
}
