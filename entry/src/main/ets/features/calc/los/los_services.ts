
// ==================== Data Retrieval ====================
import {
  DEFAULT_HQ_LEVEL,
  FleetLoSResult,
  ShipLoSResult,
  LoSEquipInfo,
  calcEquipLoSInfo,
  calcShipLoS,
  calcFleetLoS,
  LoSFleetType,
  DEFAULT_BRANCH_COEFFICIENT,
  HQLevelCoefficient,
  LoSCalculationResult,
  calcLoSScore,
  calcCombinedLoSScore,
  calcLoSForMapNode,
  calcLoSForMultipleCoefficients
} from "..";
import { joinedRowToStruct } from "../../../domain/models";
import { getRepositoryHub } from "../../../infra/storage/repo";
import { getAdmiral } from "../../state";

/** Ship info needed for LoS calculation */
interface ShipLoSData {
  shipUid: number;
  shipMasterId: number;
  shipName: string;
  /** Ship's naked LoS (without equipment) */
  nakedLoS: number;
  /** Equipment fit bonus to LoS */
  equipBonusLoS: number;
  /** Equipment list */
  equipments: Array<{
    masterId: number;
    equipType: number;
    los: number;
    level: number;
  }>;
}

/**
 * Get ship data for LoS calculation
 *
 * Note: Equipment fit bonus to LoS needs to be calculated separately
 * based on ship-equipment combinations. This is a simplified version.
 */
async function getShipLoSData(shipUid: number): Promise<ShipLoSData | null> {
  const repo = getRepositoryHub();

  // Get ship with master data
  const shipRow = await repo.ship.getWithMaster(shipUid);
  if (!shipRow) return null;

  // Parse equipment UIDs
  const equipUids: number[] = JSON.parse(shipRow.slotsJson || '[]');
  const validEquipUids = equipUids.filter(uid => uid > 0);

  // Add expansion slot if present
  if (shipRow.slotEx > 0) {
    validEquipUids.push(shipRow.slotEx);
  }

  // Get equipment data
  const equipments: ShipLoSData['equipments'] = [];
  let totalEquipLoS = 0;

  if (validEquipUids.length > 0) {
    const equipRows = await repo.slotitem.listWithMasterByUids(validEquipUids);
    for (const row of equipRows) {
      const { item, master } = joinedRowToStruct(row);
      if (master && master.stats.los !== undefined) {
        equipments.push({
          masterId: master.id,
          equipType: master.type.equipType || 0,
          los: master.stats.los || 0,
          level: item.level || 0,
        });
        totalEquipLoS += master.stats.los || 0;
      }
    }
  }

  // Ship's displayed LoS includes equipment
  // Naked LoS = displayed LoS - equipment LoS
  const displayedLoS = shipRow.sc_cur || 0;
  const nakedLoS = displayedLoS - totalEquipLoS;

  // TODO: Calculate equipment fit bonus to LoS
  // This requires ship-equipment fit bonus data
  // For now, we assume no fit bonus
  const equipBonusLoS = 0;

  return {
    shipUid,
    shipMasterId: shipRow.masterId,
    shipName: shipRow.mst_name || `Ship#${shipRow.masterId}`,
    nakedLoS: Math.max(0, nakedLoS),
    equipBonusLoS,
    equipments,
  };
}

/**
 * Get HQ level from basic data
 */
async function getHQLevel(): Promise<number> {
  const admiral = getAdmiral();
  return admiral?.level ?? DEFAULT_HQ_LEVEL;
}

// ==================== Fleet LoS Calculation ====================

/**
 * Calculate LoS for a single fleet
 *
 * @param deckId Fleet ID (1-4)
 * @param retreatedShipUids UIDs of ships that have retreated
 */
export async function getFleetLoS(
  deckId: number,
  retreatedShipUids: Set<number> = new Set(),
): Promise<FleetLoSResult | null> {
  const repo = getRepositoryHub();

  // Get fleet data
  const decks = await repo.deck.list();
  const deck = decks.find(d => d.deckId === deckId);
  if (!deck) return null;

  // Parse ship UIDs
  const shipUids: number[] = JSON.parse(deck.shipUidsJson || '[]');

  // Calculate LoS for each ship
  const shipResults: ShipLoSResult[] = [];

  for (const shipUid of shipUids) {
    if (shipUid <= 0) continue;

    const shipData = await getShipLoSData(shipUid);
    if (!shipData) continue;

    const isRetreated = retreatedShipUids.has(shipUid);

    // Calculate equipment LoS info
    const equipInfos: LoSEquipInfo[] = shipData.equipments.map(equip =>
    calcEquipLoSInfo(equip.masterId, equip.equipType, equip.los, equip.level)
    );

    const result = calcShipLoS(
      shipData.shipUid,
      shipData.shipMasterId,
      shipData.nakedLoS,
      shipData.equipBonusLoS,
      equipInfos,
      isRetreated,
      shipData.shipName,
    );

    shipResults.push(result);
  }

  return calcFleetLoS(deckId, shipResults, LoSFleetType.Single, deck.name);
}

/**
 * Calculate LoS for all 4 fleets
 */
export async function getAllFleetsLoS(
  retreatedShipUids: Set<number> = new Set(),
): Promise<FleetLoSResult[]> {
  const results: FleetLoSResult[] = [];

  for (let deckId = 1; deckId <= 4; deckId++) {
    const fleetLoS = await getFleetLoS(deckId, retreatedShipUids);
    if (fleetLoS && fleetLoS.ships.length > 0) {
      results.push(fleetLoS);
    }
  }

  return results;
}

// ==================== LoS Score Calculation ====================

/**
 * Calculate LoS score for single fleet
 *
 * @param deckId Fleet ID (1-4)
 * @param branchCoefficient Branch point coefficient
 * @param hqLevel HQ level (auto-fetched if not provided)
 * @param hqPenaltyCoefficient HQ penalty coefficient
 * @param retreatedShipUids UIDs of retreated ships
 */
export async function calcSingleFleetLoS(
  deckId: number,
  branchCoefficient: number = DEFAULT_BRANCH_COEFFICIENT,
  hqLevel?: number,
  hqPenaltyCoefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
  retreatedShipUids: Set<number> = new Set(),
): Promise<LoSCalculationResult | null> {
  const fleetLoS = await getFleetLoS(deckId, retreatedShipUids);
  if (!fleetLoS) return null;

  const level = hqLevel ?? await getHQLevel();

  return calcLoSScore(fleetLoS, branchCoefficient, level, hqPenaltyCoefficient);
}

/**
 * Calculate LoS score for combined fleet (Fleet 1 + Fleet 2)
 */
export async function calcCombinedFleetLoS(
  branchCoefficient: number = DEFAULT_BRANCH_COEFFICIENT,
  hqLevel?: number,
  hqPenaltyCoefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
  retreatedShipUids: Set<number> = new Set(),
): Promise<LoSCalculationResult | null> {
  const mainFleet = await getFleetLoS(1, retreatedShipUids);
  const escortFleet = await getFleetLoS(2, retreatedShipUids);

  if (!mainFleet || !escortFleet) return null;

  const level = hqLevel ?? await getHQLevel();

  return calcCombinedLoSScore(mainFleet, escortFleet, branchCoefficient, level, hqPenaltyCoefficient);
}

/**
 * Calculate LoS for a specific map node
 */
export async function calcFleetLoSForNode(
  deckId: number,
  mapId: string,
  node: string,
  hqLevel?: number,
  retreatedShipUids: Set<number> = new Set(),
  isCombinedFleet: boolean = false,
): Promise<LoSCalculationResult | null> {
  const level = hqLevel ?? await getHQLevel();

  if (isCombinedFleet) {
    const mainFleet = await getFleetLoS(1, retreatedShipUids);
    const escortFleet = await getFleetLoS(2, retreatedShipUids);
    if (!mainFleet || !escortFleet) return null;
    return calcLoSForMapNode(mainFleet, mapId, node, level, escortFleet);
  } else {
    const fleetLoS = await getFleetLoS(deckId, retreatedShipUids);
    if (!fleetLoS) return null;
    return calcLoSForMapNode(fleetLoS, mapId, node, level);
  }
}

/**
 * Calculate LoS with multiple branch coefficients
 * Returns a map of coefficient -> LoS score
 */
export async function calcFleetLoSMultiCoeff(
  deckId: number,
  coefficients: number[] = [1, 2, 3, 4],
  hqLevel?: number,
  hqPenaltyCoefficient: HQLevelCoefficient = HQLevelCoefficient.Standard,
  retreatedShipUids: Set<number> = new Set(),
): Promise<Map<number, number> | null> {
  const fleetLoS = await getFleetLoS(deckId, retreatedShipUids);
  if (!fleetLoS) return null;

  const level = hqLevel ?? await getHQLevel();

  return calcLoSForMultipleCoefficients(fleetLoS, coefficients, level, hqPenaltyCoefficient);
}

// ==================== Quick Calculation ====================

/**
 * Quick LoS calculation without database access
 * Useful for UI calculations
 */
export function quickCalcShipLoS(
  nakedLoS: number,
  equipments: Array<{ masterId: number; equipType: number; los: number; level: number }>,
): number {
  const equipInfos = equipments.map(e =>
  calcEquipLoSInfo(e.masterId, e.equipType, e.los, e.level)
  );

  const result = calcShipLoS(0, 0, nakedLoS, 0, equipInfos);
  return result.totalContribution;
}

/**
 * Quick LoS calculation for multiple ships
 */
export function quickCalcFleetLoS(
  ships: Array<{
    nakedLoS: number;
    equipments: Array<{ masterId: number; equipType: number; los: number; level: number }>;
  }>,
  branchCoefficient: number = 1,
  hqLevel: number = 120,
): number {
  const shipResults: ShipLoSResult[] = ships.map((ship, i) => {
    const equipInfos = ship.equipments.map(e =>
    calcEquipLoSInfo(e.masterId, e.equipType, e.los, e.level)
    );
    return calcShipLoS(i, 0, ship.nakedLoS, 0, equipInfos);
  });

  const fleetResult = calcFleetLoS(1, shipResults);
  const result = calcLoSScore(fleetResult, branchCoefficient, hqLevel);

  return result.losScore;
}

// ==================== Simulation ====================

/** Simulation input for equipment changes */
export interface LoSSimulationInput {
  /** Ship UID */
  shipUid: number;
  /** New equipment list */
  newEquipments: Array<{
    masterId: number;
    equipType: number;
    los: number;
    level: number;
  }>;
}

/**
 * Simulate fleet LoS with modified equipment
 */
export async function simulateFleetLoS(
  deckId: number,
  modifications: LoSSimulationInput[],
  branchCoefficient: number = DEFAULT_BRANCH_COEFFICIENT,
  hqLevel?: number,
  retreatedShipUids: Set<number> = new Set(),
): Promise<LoSCalculationResult | null> {
  const repo = getRepositoryHub();

  // Get fleet data
  const decks = await repo.deck.list();
  const deck = decks.find(d => d.deckId === deckId);
  if (!deck) return null;

  // Create modification map
  const modMap = new Map(modifications.map(m => [m.shipUid, m.newEquipments]));

  // Parse ship UIDs
  const shipUids: number[] = JSON.parse(deck.shipUidsJson || '[]');

  // Calculate LoS for each ship
  const shipResults: ShipLoSResult[] = [];

  for (const shipUid of shipUids) {
    if (shipUid <= 0) continue;

    const shipData = await getShipLoSData(shipUid);
    if (!shipData) continue;

    const isRetreated = retreatedShipUids.has(shipUid);

    // Use modified equipment if provided
    const equipments = modMap.has(shipUid)
      ? modMap.get(shipUid)!
      : shipData.equipments;

    const equipInfos = equipments.map(e =>
    calcEquipLoSInfo(e.masterId, e.equipType, e.los, e.level)
    );

    const result = calcShipLoS(
      shipData.shipUid,
      shipData.shipMasterId,
      shipData.nakedLoS,
      shipData.equipBonusLoS,
      equipInfos,
      isRetreated,
      shipData.shipName,
    );

    shipResults.push(result);
  }

  const fleetResult = calcFleetLoS(deckId, shipResults, LoSFleetType.Single, deck.name);
  const level = hqLevel ?? await getHQLevel();

  return calcLoSScore(fleetResult, branchCoefficient, level);
}

// ==================== Display Utilities ====================

/**
 * Format LoS results for display
 */
export interface LoSDisplayResult {
  /** LoS score for coefficient 1 */
  coeff1: number;
  /** LoS score for coefficient 2 */
  coeff2: number;
  /** LoS score for coefficient 3 */
  coeff3: number;
  /** LoS score for coefficient 4 */
  coeff4: number;
  /** Ship count */
  shipCount: number;
  /** Total base LoS */
  baseLoS: number;
  /** Total equipment LoS (raw) */
  equipLoS: number;
  /** HQ penalty */
  hqPenalty: number;
}

/**
 * Get formatted LoS results for display
 */
export async function getLoSDisplayResult(
  deckId: number,
  hqLevel?: number,
  retreatedShipUids: Set<number> = new Set(),
): Promise<LoSDisplayResult | null> {
  const fleetLoS = await getFleetLoS(deckId, retreatedShipUids);
  if (!fleetLoS) return null;

  const level = hqLevel ?? await getHQLevel();
  const coeffs = await calcFleetLoSMultiCoeff(deckId, [1, 2, 3, 4], level, HQLevelCoefficient.Standard, retreatedShipUids);
  if (!coeffs) return null;

  const hqPenalty = Math.ceil(HQLevelCoefficient.Standard * level);

  return {
    coeff1: coeffs.get(1) ?? 0,
    coeff2: coeffs.get(2) ?? 0,
    coeff3: coeffs.get(3) ?? 0,
    coeff4: coeffs.get(4) ?? 0,
    shipCount: fleetLoS.shipCount,
    baseLoS: fleetLoS.totalBaseLoS,
    equipLoS: fleetLoS.totalEquipLoS,
    hqPenalty,
  };
}
