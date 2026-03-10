// ==================== Type Definitions ====================
import {
  FleetType,
  getShipTypeTP,
  getSpecialShipTP,
  getEquipmentTP,
  isConsumableTPEquipment,
  getVictoryMultiplier,
  VictoryRank,
  isCombinedFleet
} from "..";

/** Equipment info for TP calculation */
export interface TPEquipInfo {
  /** Equipment master ID */
  masterId: number;
  /** TP value of this equipment */
  tp: number;
  /** Whether this equipment may be consumed before landing */
  mayBeConsumed: boolean;
}

/** Ship TP calculation result */
export interface ShipTPResult {
  /** Ship UID */
  shipUid: number;
  /** Ship master ID */
  shipMasterId: number;
  /** Ship name */
  shipName?: string;
  /** Ship type (stype) */
  stype: number;
  /** Whether ship is heavily damaged */
  isHeavilyDamaged: boolean;
  /** Whether ship has retreated */
  isRetreated: boolean;
  /** Whether ship contributes to TP (not damaged/retreated) */
  contributesToTP: boolean;

  /** Ship type TP */
  shipTypeTP: number;
  /** Special ship bonus TP (e.g., Kinu Kai Ni) */
  specialBonusTP: number;
  /** Equipment TP details */
  equipmentDetails: TPEquipInfo[];
  /** Total equipment TP */
  equipmentTP: number;
  /** Total TP for this ship */
  totalTP: number;

  /** Warning: has consumable TP equipment */
  hasConsumableEquipment: boolean;
}

/** Fleet TP calculation result */
export interface FleetTPResult {
  /** Fleet/Deck ID */
  deckId: number;
  /** Fleet name */
  deckName?: string;
  /** Ships in fleet */
  ships: ShipTPResult[];

  /** Total ship type TP */
  totalShipTypeTP: number;
  /** Total special bonus TP */
  totalSpecialBonusTP: number;
  /** Total equipment TP */
  totalEquipmentTP: number;
  /** Base TP (S Victory) */
  baseTP: number;
  /** A Victory TP */
  aVictoryTP: number;

  /** Number of ships contributing to TP */
  contributingShipCount: number;
  /** Number of damaged/retreated ships */
  excludedShipCount: number;
  /** Warning: has consumable TP equipment */
  hasConsumableEquipment: boolean;
}

/** Combined fleet TP calculation result */
export interface CombinedFleetTPResult {
  /** Fleet type */
  fleetType: FleetType;
  /** Main fleet (Fleet 1) result */
  mainFleet: FleetTPResult;
  /** Escort fleet (Fleet 2) result */
  escortFleet: FleetTPResult;

  /** Combined base TP (S Victory) */
  combinedBaseTP: number;
  /** Combined A Victory TP */
  combinedAVictoryTP: number;

  /** Total contributing ship count */
  totalContributingShipCount: number;
  /** Total excluded ship count */
  totalExcludedShipCount: number;
  /** Warning: has consumable TP equipment */
  hasConsumableEquipment: boolean;
}

/** Transport operation result with gauge info */
export interface TransportOperationResult {
  /** Fleet type */
  fleetType: FleetType;
  /** Is combined fleet */
  isCombined: boolean;
  /** Single fleet result (if single fleet) */
  singleFleet?: FleetTPResult;
  /** Combined fleet result (if combined fleet) */
  combinedFleet?: CombinedFleetTPResult;

  /** Final base TP (S Victory) */
  baseTP: number;
  /** Final A Victory TP */
  aVictoryTP: number;

  /** Remaining gauge to clear */
  remainingGauge?: number;
  /** Estimated sorties for S Victory */
  estimatedSortiesS?: number;
  /** Estimated sorties for A Victory */
  estimatedSortiesA?: number;
}

// ==================== Ship TP Calculation ====================

/**
 * Calculate TP for a single ship
 */
export function calcShipTP(
  shipUid: number,
  shipMasterId: number,
  stype: number,
  equipMasterIds: number[],
  isHeavilyDamaged: boolean = false,
  isRetreated: boolean = false,
  shipName?: string,
): ShipTPResult {
  const contributesToTP = !isHeavilyDamaged && !isRetreated;

  // Ship type TP
  const shipTypeTP = contributesToTP ? getShipTypeTP(stype) : 0;

  // Special ship bonus (e.g., Kinu Kai Ni +8)
  const specialBonusTP = contributesToTP ? getSpecialShipTP(shipMasterId) : 0;

  // Equipment TP
  const equipmentDetails: TPEquipInfo[] = [];
  let equipmentTP = 0;
  let hasConsumableEquipment = false;

  if (contributesToTP) {
    for (const masterId of equipMasterIds) {
      const tp = getEquipmentTP(masterId);
      if (tp > 0) {
        const mayBeConsumed = isConsumableTPEquipment(masterId);
        equipmentDetails.push({ masterId, tp, mayBeConsumed });
        equipmentTP += tp;
        if (mayBeConsumed) {
          hasConsumableEquipment = true;
        }
      }
    }
  }

  const totalTP = shipTypeTP + specialBonusTP + equipmentTP;

  return {
    shipUid,
    shipMasterId,
    shipName,
    stype,
    isHeavilyDamaged,
    isRetreated,
    contributesToTP,
    shipTypeTP,
    specialBonusTP,
    equipmentDetails,
    equipmentTP,
    totalTP,
    hasConsumableEquipment,
  };
}

// ==================== Fleet TP Calculation ====================

/**
 * Calculate TP for a single fleet
 */
export function calcFleetTP(
  deckId: number,
  ships: ShipTPResult[],
  deckName?: string,
): FleetTPResult {
  let totalShipTypeTP = 0;
  let totalSpecialBonusTP = 0;
  let totalEquipmentTP = 0;
  let contributingShipCount = 0;
  let excludedShipCount = 0;
  let hasConsumableEquipment = false;

  for (const ship of ships) {
    if (ship.contributesToTP) {
      totalShipTypeTP += ship.shipTypeTP;
      totalSpecialBonusTP += ship.specialBonusTP;
      totalEquipmentTP += ship.equipmentTP;
      contributingShipCount++;
      if (ship.hasConsumableEquipment) {
        hasConsumableEquipment = true;
      }
    } else {
      excludedShipCount++;
    }
  }

  const baseTP = totalShipTypeTP + totalSpecialBonusTP + totalEquipmentTP;
  const aVictoryTP = Math.floor(baseTP * getVictoryMultiplier(VictoryRank.A));

  return {
    deckId,
    deckName,
    ships,
    totalShipTypeTP,
    totalSpecialBonusTP,
    totalEquipmentTP,
    baseTP,
    aVictoryTP,
    contributingShipCount,
    excludedShipCount,
    hasConsumableEquipment,
  };
}

// ==================== Combined Fleet TP Calculation ====================

/**
 * Calculate TP for a combined fleet
 */
export function calcCombinedFleetTP(
  mainFleet: FleetTPResult,
  escortFleet: FleetTPResult,
  fleetType: FleetType = FleetType.TransportEscort,
): CombinedFleetTPResult {
  const combinedBaseTP = mainFleet.baseTP + escortFleet.baseTP;
  const combinedAVictoryTP = Math.floor(combinedBaseTP * getVictoryMultiplier(VictoryRank.A));

  return {
    fleetType,
    mainFleet,
    escortFleet,
    combinedBaseTP,
    combinedAVictoryTP,
    totalContributingShipCount: mainFleet.contributingShipCount + escortFleet.contributingShipCount,
    totalExcludedShipCount: mainFleet.excludedShipCount + escortFleet.excludedShipCount,
    hasConsumableEquipment: mainFleet.hasConsumableEquipment || escortFleet.hasConsumableEquipment,
  };
}

// ==================== Transport Operation Calculation ====================

/**
 * Calculate transport operation result with gauge estimation
 */
export function calcTransportOperation(
  fleetType: FleetType,
  singleFleet?: FleetTPResult,
  combinedFleet?: CombinedFleetTPResult,
  remainingGauge?: number,
): TransportOperationResult {
  const isCombined = isCombinedFleet(fleetType);

  let baseTP: number;
  let aVictoryTP: number;

  if (isCombined && combinedFleet) {
    baseTP = combinedFleet.combinedBaseTP;
    aVictoryTP = combinedFleet.combinedAVictoryTP;
  } else if (singleFleet) {
    baseTP = singleFleet.baseTP;
    aVictoryTP = singleFleet.aVictoryTP;
  } else {
    baseTP = 0;
    aVictoryTP = 0;
  }

  // Calculate estimated sorties
  let estimatedSortiesS: number | undefined;
  let estimatedSortiesA: number | undefined;

  if (remainingGauge !== undefined && remainingGauge > 0) {
    if (baseTP > 0) {
      estimatedSortiesS = Math.ceil(remainingGauge / baseTP);
    }
    if (aVictoryTP > 0) {
      estimatedSortiesA = Math.ceil(remainingGauge / aVictoryTP);
    }
  }

  return {
    fleetType,
    isCombined,
    singleFleet: isCombined ? undefined : singleFleet,
    combinedFleet: isCombined ? combinedFleet : undefined,
    baseTP,
    aVictoryTP,
    remainingGauge,
    estimatedSortiesS,
    estimatedSortiesA,
  };
}

// ==================== Utility Functions ====================

/**
 * Calculate TP for a given victory rank
 */
export function calcTPForVictory(baseTP: number, rank: VictoryRank): number {
  const multiplier = getVictoryMultiplier(rank);
  if (multiplier === 0) {
    return 0; // Transport fails below A victory
  }
  return Math.floor(baseTP * multiplier);
}

/**
 * Calculate remaining gauge after this sortie
 */
export function calcRemainingGauge(
  currentGauge: number,
  tpGained: number,
): number {
  return Math.max(0, currentGauge - tpGained);
}

/**
 * Check if transport operation will succeed (A victory or better)
 */
export function willTransportSucceed(rank: VictoryRank): boolean {
  return rank === VictoryRank.S || rank === VictoryRank.A;
}

/**
 * Calculate TP needed to clear remaining gauge in one sortie
 */
export function calcTPNeededToOneClear(
  remainingGauge: number,
  rank: VictoryRank = VictoryRank.S,
): number {
  const multiplier = getVictoryMultiplier(rank);
  if (multiplier === 0 || remainingGauge <= 0) {
    return 0;
  }
  // baseTP * multiplier >= remainingGauge
  // baseTP >= remainingGauge / multiplier
  return Math.ceil(remainingGauge / multiplier);
}

/**
 * Format TP result as a summary string
 */
export function formatTPSummary(result: TransportOperationResult): string {
  const lines: string[] = [];

  lines.push(`Fleet Type: ${result.isCombined ? 'Combined' : 'Single'}`);
  lines.push(`Base TP (S): ${result.baseTP}`);
  lines.push(`A Victory TP: ${result.aVictoryTP}`);

  if (result.remainingGauge !== undefined) {
    lines.push(`Remaining Gauge: ${result.remainingGauge}`);
    if (result.estimatedSortiesS !== undefined) {
      lines.push(`Est. Sorties (S): ${result.estimatedSortiesS}`);
    }
    if (result.estimatedSortiesA !== undefined) {
      lines.push(`Est. Sorties (A): ${result.estimatedSortiesA}`);
    }
  }

  return lines.join('\n');
}

// ==================== TP Breakdown ====================

/** TP breakdown by category */
export interface TPBreakdown {
  /** Ship type TP total */
  shipTypeTP: number;
  /** Special bonus TP total */
  specialBonusTP: number;
  /** Drum Can TP total */
  drumCanTP: number;
  /** Daihatsu TP total */
  daihatsuTP: number;
  /** Type 2 Amphibious TP total */
  type2AmphibiousTP: number;
  /** Combat ration TP total (may be consumed) */
  rationTP: number;
  /** Other equipment TP total */
  otherEquipmentTP: number;
  /** Grand total */
  total: number;
}

/**
 * Get detailed TP breakdown
 */
export function getTPBreakdown(result: FleetTPResult): TPBreakdown {
  let drumCanTP = 0;
  let daihatsuTP = 0;
  let type2AmphibiousTP = 0;
  let rationTP = 0;
  let otherEquipmentTP = 0;

  // Drum Can ID
  const DRUM_CAN_ID = 75;
  // Type 2 Amphibious ID
  const TYPE_2_AMPHIBIOUS_ID = 167;
  // Combat ration IDs
  const RATION_IDS = new Set([145, 241, 150]);
  // Daihatsu IDs (all 8 TP equipment except drum can and type 2)
  const DAIHATSU_IDS = new Set([68, 166, 193, 230, 409, 436, 355, 494, 495, 449, 482]);

  for (const ship of result.ships) {
    for (const equip of ship.equipmentDetails) {
      if (equip.masterId === DRUM_CAN_ID) {
        drumCanTP += equip.tp;
      } else if (DAIHATSU_IDS.has(equip.masterId)) {
        daihatsuTP += equip.tp;
      } else if (equip.masterId === TYPE_2_AMPHIBIOUS_ID) {
        type2AmphibiousTP += equip.tp;
      } else if (RATION_IDS.has(equip.masterId)) {
        rationTP += equip.tp;
      } else {
        otherEquipmentTP += equip.tp;
      }
    }
  }

  return {
    shipTypeTP: result.totalShipTypeTP,
    specialBonusTP: result.totalSpecialBonusTP,
    drumCanTP,
    daihatsuTP,
    type2AmphibiousTP,
    rationTP,
    otherEquipmentTP,
    total: result.baseTP,
  };
}
