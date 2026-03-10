/**
 * Line of Sight (LoS) Calculator
 *
 * Implements Formula 33 (判定式33) for map routing calculations.
 *
 * Formula:
 *   LoS Score = Σ√(ship base LoS)
 *             + branch coefficient × Σ(equip coefficient × (equip LoS + improvement coefficient × √★))
 *             - ceil(HQ penalty coefficient × HQ level)
 *             + 2 × (6 - ship count)
 *
 * Reference: https://wikiwiki.jp/kancolle/ルート分岐
 */
import {
  LoSEquipCategory,
  LoSFleetType,
  HQLevelCoefficient,
  BranchPointInfo,
  NIGHT_FIGHTER_IDS,
  NIGHT_TORPEDO_BOMBER_IDS,
  EQUIP_TYPE_TO_LOS_CATEGORY,
  LOS_EQUIP_COEFFICIENT,
  LOS_IMPROVEMENT_COEFFICIENT,
  STRIKING_FORCE_SIZE_ADJUSTMENT_BASE,
  FLEET_SIZE_ADJUSTMENT_BASE,
  DEFAULT_BRANCH_COEFFICIENT,
  DEFAULT_HQ_LEVEL,
  getBranchPointInfo
} from "./los_types";

// ==================== Type Definitions ====================

/** Equipment info for LoS calculation */
export interface LoSEquipInfo {
  /** Equipment master ID */
  masterId: number;
  /** Equipment type (api_type[2]) */
  equipType: number;
  /** Equipment LoS value */
  los: number;
  /** Improvement level (0-10) */
  level: number;
  /** Calculated LoS category */
  category: LoSEquipCategory;
  /** Equipment coefficient */
  equipCoefficient: number;
  /** Improvement coefficient */
  improvementCoefficient: number;
  /** Raw LoS contribution (before branch coefficient) */
  rawContribution: number;
}

/** Ship LoS calculation result */
export interface ShipLoSResult {
  /** Ship UID */
  shipUid: number;
  /** Ship master ID */
  shipMasterId: number;
  /** Ship name */
  shipName?: string;
  /** Ship base LoS (naked, without equipment) */
  baseLoS: number;
  /** Ship base LoS contribution: sqrt(baseLoS) */
  baseLoSContribution: number;
  /** Equipment bonus to base LoS (from fit bonuses) */
  equipBonusLoS: number;
  /** Whether ship has retreated */
  isRetreated: boolean;
  /** Whether ship contributes to LoS */
  contributesToLoS: boolean;

  /** Equipment details */
  equipments: LoSEquipInfo[];
  /** Total equipment LoS contribution (before branch coefficient) */
  totalEquipContribution: number;

  /** Total contribution from this ship (without branch coefficient applied to equipment) */
  totalContribution: number;
}

/** Fleet LoS calculation result */
export interface FleetLoSResult {
  /** Fleet ID */
  deckId: number;
  /** Fleet name */
  deckName?: string;
  /** Ships in fleet */
  ships: ShipLoSResult[];

  /** Total ship base LoS contribution: Σ√(baseLoS) */
  totalBaseLoS: number;
  /** Total equipment LoS contribution (before branch coefficient) */
  totalEquipLoS: number;
  /** Number of ships contributing */
  shipCount: number;
  /** Fleet size adjustment: 2 × (base - shipCount) */
  sizeAdjustment: number;

  /** Raw LoS score (branch coefficient = 1, no HQ penalty) */
  rawLoSScore: number;
}

/** Full LoS calculation result with branch coefficient applied */
export interface LoSCalculationResult {
  /** Fleet result(s) */
  fleetResult: FleetLoSResult;
  /** Escort fleet result (for combined fleet) */
  escortFleetResult?: FleetLoSResult;

  /** Fleet type */
  fleetType: LoSFleetType;
  /** Branch point coefficient used */
  branchCoefficient: number;
  /** HQ level used */
  hqLevel: number;
  /** HQ penalty coefficient used */
  hqPenaltyCoefficient: HQLevelCoefficient;
  /** HQ level penalty: ceil(hqPenaltyCoefficient × hqLevel) */
  hqLevelPenalty: number;

  /** Total base LoS contribution */
  totalBaseLoS: number;
  /** Total equipment LoS contribution (after branch coefficient) */
  totalEquipLoS: number;
  /** Total fleet size adjustment */
  totalSizeAdjustment: number;

  /** Final LoS score */
  losScore: number;

  /** Branch point info if available */
  branchPointInfo?: BranchPointInfo;
  /** Whether LoS meets requirement (if known) */
  meetsRequirement?: boolean;
}

// ==================== Equipment Category Detection ====================

/**
 * Determine LoS category for equipment
 */
export function getLoSCategory(masterId: number, equipType: number): LoSEquipCategory {
  // Check for night aircraft first (they share type IDs)
  if (NIGHT_FIGHTER_IDS.has(masterId)) {
    return LoSEquipCategory.NightFighter;
  }
  if (NIGHT_TORPEDO_BOMBER_IDS.has(masterId)) {
    return LoSEquipCategory.NightTorpedoBomber;
  }

  // Look up by equipment type
  const category = EQUIP_TYPE_TO_LOS_CATEGORY.get(equipType);
  return category ?? LoSEquipCategory.Other;
}

/**
 * Get equipment coefficient
 */
export function getEquipCoefficient(category: LoSEquipCategory): number {
  return LOS_EQUIP_COEFFICIENT[category];
}

/**
 * Get improvement coefficient
 */
export function getImprovementCoefficient(category: LoSEquipCategory): number {
  return LOS_IMPROVEMENT_COEFFICIENT[category];
}

// ==================== Equipment LoS Calculation ====================

/**
 * Calculate equipment LoS contribution (before branch coefficient)
 *
 * Formula: equipCoefficient × (equipLoS + improvementCoefficient × √level)
 */
export function calcEquipLoSContribution(
  los: number,
  level: number,
  category: LoSEquipCategory,
): number {
  const equipCoeff = getEquipCoefficient(category);
  const improvementCoeff = getImprovementCoefficient(category);

  const improvementBonus = improvementCoeff * Math.sqrt(level);
  return equipCoeff * (los + improvementBonus);
}

/**
 * Calculate equipment info for LoS
 */
export function calcEquipLoSInfo(
  masterId: number,
  equipType: number,
  los: number,
  level: number,
): LoSEquipInfo {
  const category = getLoSCategory(masterId, equipType);
  const equipCoefficient = getEquipCoefficient(category);
  const improvementCoefficient = getImprovementCoefficient(category);
  const rawContribution = calcEquipLoSContribution(los, level, category);

  return {
    masterId,
    equipType,
    los,
    level,
    category,
    equipCoefficient,
    improvementCoefficient,
    rawContribution,
  };
}

// ==================== Ship LoS Calculation ====================

/**
 * Calculate ship LoS contribution
 *
 * @param baseLoS Ship's naked LoS value (without equipment)
 * @param equipBonusLoS Equipment fit bonus to LoS (adds to base)
 * @param equipments Equipment info array
 * @param isRetreated Whether ship has retreated
 */
export function calcShipLoS(
  shipUid: number,
  shipMasterId: number,
  baseLoS: number,
  equipBonusLoS: number,
  equipments: LoSEquipInfo[],
  isRetreated: boolean = false,
  shipName?: string,
): ShipLoSResult {
  const contributesToLoS = !isRetreated;

  // Base LoS contribution: sqrt(baseLoS + equipBonusLoS)
  // Equipment fit bonus adds to base LoS
  const effectiveBaseLoS = baseLoS + equipBonusLoS;
  const baseLoSContribution = contributesToLoS ? Math.sqrt(effectiveBaseLoS) : 0;

  // Equipment contribution
  let totalEquipContribution = 0;
  if (contributesToLoS) {
    for (const equip of equipments) {
      totalEquipContribution += equip.rawContribution;
    }
  }

  const totalContribution = baseLoSContribution + totalEquipContribution;

  return {
    shipUid,
    shipMasterId,
    shipName,
    baseLoS,
    baseLoSContribution,
    equipBonusLoS,
    isRetreated,
    contributesToLoS,
    equipments: contributesToLoS ? equipments : [],
    totalEquipContribution,
    totalContribution,
  };
}

// ==================== Fleet LoS Calculation ====================

/**
 * Calculate fleet LoS (before HQ penalty)
 *
 * @param deckId Fleet ID
 * @param ships Ship LoS results
 * @param fleetType Fleet type (affects size adjustment base)
 * @param deckName Optional fleet name
 */
export function calcFleetLoS(
  deckId: number,
  ships: ShipLoSResult[],
  fleetType: LoSFleetType = LoSFleetType.Single,
  deckName?: string,
): FleetLoSResult {
  let totalBaseLoS = 0;
  let totalEquipLoS = 0;
  let shipCount = 0;

  for (const ship of ships) {
    if (ship.contributesToLoS) {
      totalBaseLoS += ship.baseLoSContribution;
      totalEquipLoS += ship.totalEquipContribution;
      shipCount++;
    }
  }

  // Size adjustment base depends on fleet type
  const sizeBase = fleetType === LoSFleetType.StrikingForce
    ? STRIKING_FORCE_SIZE_ADJUSTMENT_BASE
    : FLEET_SIZE_ADJUSTMENT_BASE;

  const sizeAdjustment = 2 * (sizeBase - shipCount);

  // Raw score (branch coefficient = 1, no HQ penalty)
  const rawLoSScore = totalBaseLoS + totalEquipLoS + sizeAdjustment;

  return {
    deckId,
    deckName,
    ships,
    totalBaseLoS,
    totalEquipLoS,
    shipCount,
    sizeAdjustment,
    rawLoSScore,
  };
}

// ==================== Full LoS Calculation ====================

/**
 * Calculate HQ level penalty
 *
 * Formula: ceil(hqPenaltyCoefficient × hqLevel)
 */
export function calcHQLevelPenalty(
  hqLevel: number,
  coefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
): number {
  return Math.ceil(coefficient * hqLevel);
}

/**
 * Calculate final LoS score for single fleet
 *
 * @param fleetResult Fleet LoS result
 * @param branchCoefficient Branch point coefficient
 * @param hqLevel HQ level
 * @param hqPenaltyCoefficient HQ penalty coefficient
 */
export function calcLoSScore(
  fleetResult: FleetLoSResult,
  branchCoefficient: number = DEFAULT_BRANCH_COEFFICIENT,
  hqLevel: number = DEFAULT_HQ_LEVEL,
  hqPenaltyCoefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
): LoSCalculationResult {
  const hqLevelPenalty = calcHQLevelPenalty(hqLevel, hqPenaltyCoefficient);

  // Equipment LoS with branch coefficient
  const totalEquipLoS = branchCoefficient * fleetResult.totalEquipLoS;

  // Final score
  const losScore = fleetResult.totalBaseLoS + totalEquipLoS - hqLevelPenalty + fleetResult.sizeAdjustment;

  return {
    fleetResult,
    fleetType: LoSFleetType.Single,
    branchCoefficient,
    hqLevel,
    hqPenaltyCoefficient,
    hqLevelPenalty,
    totalBaseLoS: fleetResult.totalBaseLoS,
    totalEquipLoS,
    totalSizeAdjustment: fleetResult.sizeAdjustment,
    losScore,
  };
}

/**
 * Calculate final LoS score for combined fleet
 *
 * Combined fleet LoS = sum of both fleets' contributions
 */
export function calcCombinedLoSScore(
  mainFleetResult: FleetLoSResult,
  escortFleetResult: FleetLoSResult,
  branchCoefficient: number = DEFAULT_BRANCH_COEFFICIENT,
  hqLevel: number = DEFAULT_HQ_LEVEL,
  hqPenaltyCoefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
): LoSCalculationResult {
  const hqLevelPenalty = calcHQLevelPenalty(hqLevel, hqPenaltyCoefficient);

  // Combined totals
  const totalBaseLoS = mainFleetResult.totalBaseLoS + escortFleetResult.totalBaseLoS;
  const rawEquipLoS = mainFleetResult.totalEquipLoS + escortFleetResult.totalEquipLoS;
  const totalEquipLoS = branchCoefficient * rawEquipLoS;
  const totalSizeAdjustment = mainFleetResult.sizeAdjustment + escortFleetResult.sizeAdjustment;

  // Final score
  const losScore = totalBaseLoS + totalEquipLoS - hqLevelPenalty + totalSizeAdjustment;

  return {
    fleetResult: mainFleetResult,
    escortFleetResult,
    fleetType: LoSFleetType.Combined,
    branchCoefficient,
    hqLevel,
    hqPenaltyCoefficient,
    hqLevelPenalty,
    totalBaseLoS,
    totalEquipLoS,
    totalSizeAdjustment,
    losScore,
  };
}

/**
 * Calculate LoS score for a specific map node
 */
export function calcLoSForMapNode(
  fleetResult: FleetLoSResult,
  mapId: string,
  node: string,
  hqLevel: number = DEFAULT_HQ_LEVEL,
  escortFleetResult?: FleetLoSResult,
): LoSCalculationResult {
  const branchPointInfo = getBranchPointInfo(mapId, node);
  const branchCoefficient = branchPointInfo?.coefficient ?? DEFAULT_BRANCH_COEFFICIENT;
  const hqPenaltyCoefficient = branchPointInfo?.hqCoefficient ?? HQLevelCoefficient.Standard;

  let result: LoSCalculationResult;

  if (escortFleetResult) {
    result = calcCombinedLoSScore(
      fleetResult,
      escortFleetResult,
      branchCoefficient,
      hqLevel,
      hqPenaltyCoefficient,
    );
  } else {
    result = calcLoSScore(
      fleetResult,
      branchCoefficient,
      hqLevel,
      hqPenaltyCoefficient,
    );
  }

  // Add branch point info and check requirement
  result.branchPointInfo = branchPointInfo;
  if (branchPointInfo?.requiredLoS !== undefined) {
    result.meetsRequirement = result.losScore >= branchPointInfo.requiredLoS;
  }

  return result;
}

// ==================== Utility Functions ====================

/**
 * Calculate LoS for multiple branch coefficients
 * Useful for displaying LoS with different coefficients
 */
export function calcLoSForMultipleCoefficients(
  fleetResult: FleetLoSResult,
  coefficients: number[] = [1, 2, 3, 4],
  hqLevel: number = DEFAULT_HQ_LEVEL,
  hqPenaltyCoefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
): Map<number, number> {
  const hqLevelPenalty = calcHQLevelPenalty(hqLevel, hqPenaltyCoefficient);
  const results = new Map<number, number>();

  for (const coefficient of coefficients) {
    const totalEquipLoS = coefficient * fleetResult.totalEquipLoS;
    const losScore = fleetResult.totalBaseLoS + totalEquipLoS - hqLevelPenalty + fleetResult.sizeAdjustment;
    results.set(coefficient, losScore);
  }

  return results;
}

/**
 * Calculate required equipment LoS to reach target score
 */
export function calcRequiredEquipLoS(
  targetLoS: number,
  baseLoSContribution: number,
  sizeAdjustment: number,
  hqLevelPenalty: number,
  branchCoefficient: number,
): number {
  // targetLoS = baseLoS + branchCoeff × equipLoS - hqPenalty + sizeAdj
  // equipLoS = (targetLoS - baseLoS + hqPenalty - sizeAdj) / branchCoeff
  const requiredRaw = (targetLoS - baseLoSContribution + hqLevelPenalty - sizeAdjustment) / branchCoefficient;
  return Math.max(0, requiredRaw);
}

/**
 * Format LoS result as summary string
 */
export function formatLoSSummary(result: LoSCalculationResult): string {
  const lines: string[] = [];

  lines.push(`LoS Score: ${result.losScore.toFixed(2)}`);
  lines.push(`Branch Coefficient: ${result.branchCoefficient}`);
  lines.push(`Base LoS: ${result.totalBaseLoS.toFixed(2)}`);
  lines.push(`Equip LoS: ${result.totalEquipLoS.toFixed(2)}`);
  lines.push(`HQ Penalty: -${result.hqLevelPenalty}`);
  lines.push(`Size Adj: ${result.totalSizeAdjustment >= 0 ? '+' : ''}${result.totalSizeAdjustment}`);

  if (result.branchPointInfo?.requiredLoS !== undefined) {
    lines.push(`Required: ${result.branchPointInfo.requiredLoS}`);
    lines.push(`Status: ${result.meetsRequirement ? 'OK' : 'INSUFFICIENT'}`);
  }

  return lines.join('\n');
}

// ==================== LoS Breakdown ====================

/** LoS breakdown by category */
export interface LoSBreakdown {
  /** Ship base LoS total */
  baseLoS: number;
  /** Seaplane Recon contribution */
  seaplaneRecon: number;
  /** Seaplane Bomber contribution */
  seaplaneBomber: number;
  /** Carrier Recon contribution */
  carrierRecon: number;
  /** Radar contribution */
  radar: number;
  /** Other equipment contribution */
  otherEquip: number;
  /** HQ penalty */
  hqPenalty: number;
  /** Size adjustment */
  sizeAdjustment: number;
  /** Total score */
  total: number;
}

/**
 * Get detailed LoS breakdown
 */
export function getLoSBreakdown(result: LoSCalculationResult): LoSBreakdown {
  let seaplaneRecon = 0;
  let seaplaneBomber = 0;
  let carrierRecon = 0;
  let radar = 0;
  let otherEquip = 0;

  const processFleet = (fleetResult: FleetLoSResult) => {
    for (const ship of fleetResult.ships) {
      for (const equip of ship.equipments) {
        const contribution = equip.rawContribution * result.branchCoefficient;
        switch (equip.category) {
          case LoSEquipCategory.SeaplaneRecon:
            seaplaneRecon += contribution;
            break;
          case LoSEquipCategory.SeaplaneBomber:
            seaplaneBomber += contribution;
            break;
          case LoSEquipCategory.CarrierRecon:
            carrierRecon += contribution;
            break;
          case LoSEquipCategory.SmallRadar:
          case LoSEquipCategory.LargeRadar:
            radar += contribution;
            break;
          default:
            otherEquip += contribution;
            break;
        }
      }
    }
  };

  processFleet(result.fleetResult);
  if (result.escortFleetResult) {
    processFleet(result.escortFleetResult);
  }

  return {
    baseLoS: result.totalBaseLoS,
    seaplaneRecon,
    seaplaneBomber,
    carrierRecon,
    radar,
    otherEquip,
    hqPenalty: -result.hqLevelPenalty,
    sizeAdjustment: result.totalSizeAdjustment,
    total: result.losScore,
  };
}
