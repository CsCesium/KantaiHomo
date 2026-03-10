// ==================== Ship Data Retrieval ====================
import {
  FleetTPResult,
  ShipTPResult,
  calcShipTP,
  calcFleetTP,
  FleetType,
  CombinedFleetTPResult,
  calcCombinedFleetTP,
  TransportOperationResult,
  calcTransportOperation
} from "..";
import { joinedRowToStruct } from "../../../domain/models";
import { getRepositoryHub } from "../../../infra/storage/repo";

/** Ship info needed for TP calculation */
interface ShipTPData {
  shipUid: number;
  shipMasterId: number;
  shipName: string;
  stype: number;
  equipMasterIds: number[];
  hp: number;
  maxHp: number;
}

/**
 * Check if ship is heavily damaged (大破)
 * HP ratio <= 25% is heavily damaged
 */
export function isHeavilyDamaged(hp: number, maxHp: number): boolean {
  if (maxHp <= 0) return false;
  return hp / maxHp <= 0.25;
}

/**
 * Get ship data for TP calculation
 */
async function getShipTPData(shipUid: number): Promise<ShipTPData | null> {
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

  // Get equipment master IDs
  const equipMasterIds: number[] = [];
  if (validEquipUids.length > 0) {
    const equipRows = await repo.slotitem.listWithMasterByUids(validEquipUids);
    for (const row of equipRows) {
      const { item, master } = joinedRowToStruct(row);
      if (master) {
        equipMasterIds.push(master.id);
      }
    }
  }

  return {
    shipUid,
    shipMasterId: shipRow.masterId,
    shipName: shipRow.mst_name || `Ship#${shipRow.masterId}`,
    stype: shipRow.mst_stype || 0,
    equipMasterIds,
    hp: shipRow.nowHp || 0,
    maxHp: shipRow.maxHp || 0,
  };
}

// ==================== Fleet TP Calculation ====================

/**
 * Calculate TP for a fleet
 *
 * @param deckId Fleet ID (1-4)
 * @param retreatedShipUids UIDs of ships that have retreated
 */
export async function getFleetTP(
  deckId: number,
  retreatedShipUids: Set<number> = new Set(),
): Promise<FleetTPResult | null> {
  const repo = getRepositoryHub();

  // Get fleet data
  const decks = await repo.deck.list();
  const deck = decks.find(d => d.deckId === deckId);
  if (!deck) return null;

  // Parse ship UIDs
  const shipUids: number[] = JSON.parse(deck.shipUidsJson || '[]');

  // Calculate TP for each ship
  const shipResults: ShipTPResult[] = [];

  for (const shipUid of shipUids) {
    if (shipUid <= 0) continue;

    const shipData = await getShipTPData(shipUid);
    if (!shipData) continue;

    const isRetreated = retreatedShipUids.has(shipUid);
    const isDamaged = isHeavilyDamaged(shipData.hp, shipData.maxHp);

    const result = calcShipTP(
      shipData.shipUid,
      shipData.shipMasterId,
      shipData.stype,
      shipData.equipMasterIds,
      isDamaged,
      isRetreated,
      shipData.shipName,
    );

    shipResults.push(result);
  }

  return calcFleetTP(deckId, shipResults, deck.name);
}

/**
 * Calculate TP for all 4 fleets
 */
export async function getAllFleetsTP(
  retreatedShipUids: Set<number> = new Set(),
): Promise<FleetTPResult[]> {
  const results: FleetTPResult[] = [];

  for (let deckId = 1; deckId <= 4; deckId++) {
    const fleetTP = await getFleetTP(deckId, retreatedShipUids);
    if (fleetTP && fleetTP.ships.length > 0) {
      results.push(fleetTP);
    }
  }

  return results;
}

// ==================== Combined Fleet TP Calculation ====================

/**
 * Calculate TP for combined fleet (Fleet 1 + Fleet 2)
 *
 * @param fleetType Combined fleet type
 * @param retreatedShipUids UIDs of ships that have retreated
 */
export async function getCombinedFleetTP(
  fleetType: FleetType = FleetType.TransportEscort,
  retreatedShipUids: Set<number> = new Set(),
): Promise<CombinedFleetTPResult | null> {
  const mainFleet = await getFleetTP(1, retreatedShipUids);
  const escortFleet = await getFleetTP(2, retreatedShipUids);

  if (!mainFleet || !escortFleet) {
    return null;
  }

  return calcCombinedFleetTP(mainFleet, escortFleet, fleetType);
}

// ==================== Transport Operation Calculation ====================

/**
 * Calculate transport operation for single fleet
 *
 * @param deckId Fleet ID (1-4)
 * @param remainingGauge Remaining transport gauge (optional)
 * @param retreatedShipUids UIDs of ships that have retreated
 */
export async function calcSingleFleetTransport(
  deckId: number,
  remainingGauge?: number,
  retreatedShipUids: Set<number> = new Set(),
): Promise<TransportOperationResult | null> {
  const fleetTP = await getFleetTP(deckId, retreatedShipUids);
  if (!fleetTP) return null;

  return calcTransportOperation(
    FleetType.Single,
    fleetTP,
    undefined,
    remainingGauge,
  );
}

/**
 * Calculate transport operation for combined fleet
 *
 * @param fleetType Combined fleet type
 * @param remainingGauge Remaining transport gauge (optional)
 * @param retreatedShipUids UIDs of ships that have retreated
 */
export async function calcCombinedFleetTransport(
  fleetType: FleetType = FleetType.TransportEscort,
  remainingGauge?: number,
  retreatedShipUids: Set<number> = new Set(),
): Promise<TransportOperationResult | null> {
  const combinedFleetTP = await getCombinedFleetTP(fleetType, retreatedShipUids);
  if (!combinedFleetTP) return null;

  return calcTransportOperation(
    fleetType,
    undefined,
    combinedFleetTP,
    remainingGauge,
  );
}

// ==================== Simulation Functions ====================

/**
 * Simulate TP for different equipment configurations
 * Useful for optimizing transport loadout
 */
export interface TPSimulationInput {
  /** Ship UID */
  shipUid: number;
  /** New equipment master IDs to simulate */
  newEquipMasterIds: number[];
}

/**
 * Simulate fleet TP with modified equipment
 */
export async function simulateFleetTP(
  deckId: number,
  modifications: TPSimulationInput[],
  retreatedShipUids: Set<number> = new Set(),
): Promise<FleetTPResult | null> {
  const repo = getRepositoryHub();

  // Get fleet data
  const decks = await repo.deck.list();
  const deck = decks.find(d => d.deckId === deckId);
  if (!deck) return null;

  // Create modification map
  const modMap = new Map<number, number[]>();
  for (const mod of modifications) {
    modMap.set(mod.shipUid, mod.newEquipMasterIds);
  }

  // Parse ship UIDs
  const shipUids: number[] = JSON.parse(deck.shipUidsJson || '[]');

  // Calculate TP for each ship
  const shipResults: ShipTPResult[] = [];

  for (const shipUid of shipUids) {
    if (shipUid <= 0) continue;

    const shipData = await getShipTPData(shipUid);
    if (!shipData) continue;

    // Use modified equipment if provided
    const equipMasterIds = modMap.has(shipUid)
      ? modMap.get(shipUid)!
      : shipData.equipMasterIds;

    const isRetreated = retreatedShipUids.has(shipUid);
    const isDamaged = isHeavilyDamaged(shipData.hp, shipData.maxHp);

    const result = calcShipTP(
      shipData.shipUid,
      shipData.shipMasterId,
      shipData.stype,
      equipMasterIds,
      isDamaged,
      isRetreated,
      shipData.shipName,
    );

    shipResults.push(result);
  }

  return calcFleetTP(deckId, shipResults, deck.name);
}

// ==================== Quick TP Calculation ====================

/**
 * Quick TP calculation without database access
 * Useful for UI calculations
 */
export function quickCalcShipTP(
  stype: number,
  shipMasterId: number,
  equipMasterIds: number[],
): number {
  const result = calcShipTP(
    0, // dummy UID
    shipMasterId,
    stype,
    equipMasterIds,
    false,
    false,
  );
  return result.totalTP;
}

/**
 * Quick TP calculation for multiple ships
 */
export function quickCalcFleetTP(
  ships: Array<{
    stype: number;
    masterId: number;
    equipMasterIds: number[];
  }>,
): number {
  let total = 0;
  for (const ship of ships) {
    total += quickCalcShipTP(ship.stype, ship.masterId, ship.equipMasterIds);
  }
  return total;
}
