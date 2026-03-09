/**
 * Fleet Fighter Power Calculator Service
 *
 * Calculates fleet fighter power based on GameState and database data
 */

import { joinedRowToStruct } from '../../../domain/models/mapper/slotitem';
import { SlotItemMaster } from '../../../domain/models';
import {
  calcSlotFighterPower,
  calcAirStateResult,
  isAirCombatEquip,
  SlotFighterPower,
  ShipFighterPower,
  FleetFighterPower,
  AirStateResult,
} from './fighter_power';
import { getRepositoryHub } from '../../../infra/storage/repo';

// ==================== Type Definitions ====================

/** Equipment slot info for calculation */
export interface SlotInfo {
  /** Equipment UID (-1 means empty slot) */
  equipUid: number;
  /** Slot size (aircraft capacity) */
  slotSize: number;
  /** Equipment master data (if equipped) */
  master?: SlotItemMaster;
  /** Improvement level */
  level: number;
  /** Proficiency (0-7) */
  proficiency: number;
}

/** Ship equipment info */
export interface ShipEquipInfo {
  /** Ship UID */
  shipUid: number;
  /** Ship masterId */
  shipMasterId: number;
  /** Ship name */
  shipName: string;
  /** Regular equipment slots */
  slots: SlotInfo[];
  /** Reinforcement expansion slot */
  exSlot?: SlotInfo;
}

/** Fleet equipment info */
export interface FleetEquipInfo {
  /** Fleet/Deck ID */
  deckId: number;
  /** Fleet name */
  deckName: string;
  /** Equipment info for each ship */
  ships: ShipEquipInfo[];
}

// ==================== Data Retrieval Functions ====================

/**
 * Get ship equipment info
 */
export async function getShipEquipInfo(shipUid: number): Promise<ShipEquipInfo | null> {
  const repo = getRepositoryHub();

  // Get ship data
  const shipRow = await repo.ship.getWithMaster(shipUid);
  if (!shipRow) return null;

  // Parse equipment slots
  const equipUids: number[] = JSON.parse(shipRow.slotsJson || '[]');
  const onslot: number[] = JSON.parse(shipRow.onslotJson || '[]');

  // Get master data for all equipment
  const validEquipUids = equipUids.filter(uid => uid > 0);
  if (shipRow.slotEx > 0) {
    validEquipUids.push(shipRow.slotEx);
  }

  const equipRows = validEquipUids.length > 0
    ? await repo.slotitem.listWithMasterByUids(validEquipUids)
    : [];

  // Build equipment UID -> data mapping
  const equipMap = new Map<number, { master: SlotItemMaster | null; level: number; alv: number }>();
  for (const row of equipRows) {
    const { item, master } = joinedRowToStruct(row);
    equipMap.set(item.uid, {
      master,
      level: item.level || 0,
      alv: item.alv || 0,
    });
  }

  // Build slot info
  const slots: SlotInfo[] = equipUids.map((uid, i) => {
    const equipInfo = equipMap.get(uid);
    return {
      equipUid: uid,
      slotSize: onslot[i] || 0,
      master: equipInfo?.master || undefined,
      level: equipInfo?.level || 0,
      proficiency: equipInfo?.alv || 0,
    };
  });

  // Reinforcement expansion slot
  let exSlot: SlotInfo | undefined;
  if (shipRow.slotEx > 0) {
    const exEquipInfo = equipMap.get(shipRow.slotEx);
    exSlot = {
      equipUid: shipRow.slotEx,
      slotSize: 0, // Expansion slot has no aircraft capacity
      master: exEquipInfo?.master || undefined,
      level: exEquipInfo?.level || 0,
      proficiency: exEquipInfo?.alv || 0,
    };
  }

  return {
    shipUid,
    shipMasterId: shipRow.masterId,
    shipName: shipRow.mst_name || `Ship#${shipRow.masterId}`,
    slots,
    exSlot,
  };
}

/**
 * Get fleet equipment info
 */
export async function getFleetEquipInfo(deckId: number): Promise<FleetEquipInfo | null> {
  const repo = getRepositoryHub();

  // Get fleet data
  const decks = await repo.deck.list();
  const deck = decks.find(d => d.deckId === deckId);
  if (!deck) return null;

  // Parse ship UIDs
  const shipUids: number[] = JSON.parse(deck.shipUidsJson || '[]');

  // Get equipment info for each ship
  const ships: ShipEquipInfo[] = [];
  for (const shipUid of shipUids) {
    if (shipUid <= 0) continue;
    const shipInfo = await getShipEquipInfo(shipUid);
    if (shipInfo) {
      ships.push(shipInfo);
    }
  }

  return {
    deckId,
    deckName: deck.name,
    ships,
  };
}

// ==================== Fighter Power Calculation Functions ====================

/**
 * Calculate single ship fighter power
 */
export function calcShipFighterPowerFromInfo(info: ShipEquipInfo): ShipFighterPower {
  const slots: SlotFighterPower[] = [];
  let total = 0;
  let totalMin = 0;
  let totalMax = 0;

  for (const slot of info.slots) {
    if (!slot.master || slot.slotSize <= 0) {
      continue;
    }

    // Only calculate equipment that participates in air combat
    if (!isAirCombatEquip(slot.master.type.equipType)) {
      continue;
    }

    const fp = calcSlotFighterPower(
      slot.master,
      slot.slotSize,
      slot.level,
      slot.proficiency
    );

    slots.push(fp);
    total += fp.fighterPower;
    totalMin += fp.fighterPowerMin;
    totalMax += fp.fighterPowerMax;
  }

  return {
    shipUid: info.shipUid,
    shipName: info.shipName,
    slots,
    totalFighterPower: total,
    totalFighterPowerMin: totalMin,
    totalFighterPowerMax: totalMax,
  };
}

/**
 * Calculate fleet fighter power
 */
export function calcFleetFighterPowerFromInfo(info: FleetEquipInfo): FleetFighterPower {
  const ships: ShipFighterPower[] = [];
  let total = 0;
  let totalMin = 0;
  let totalMax = 0;

  for (const shipInfo of info.ships) {
    const shipFP = calcShipFighterPowerFromInfo(shipInfo);
    ships.push(shipFP);
    total += shipFP.totalFighterPower;
    totalMin += shipFP.totalFighterPowerMin;
    totalMax += shipFP.totalFighterPowerMax;
  }

  return {
    deckId: info.deckId,
    ships,
    totalFighterPower: total,
    totalFighterPowerMin: totalMin,
    totalFighterPowerMax: totalMax,
  };
}

// ==================== High-level API ====================

/**
 * Get and calculate ship fighter power
 */
export async function getShipFighterPower(shipUid: number): Promise<ShipFighterPower | null> {
  const info = await getShipEquipInfo(shipUid);
  if (!info) return null;
  return calcShipFighterPowerFromInfo(info);
}

/**
 * Get and calculate fleet fighter power
 */
export async function getFleetFighterPower(deckId: number): Promise<FleetFighterPower | null> {
  const info = await getFleetEquipInfo(deckId);
  if (!info) return null;
  return calcFleetFighterPowerFromInfo(info);
}

/**
 * Calculate fleet air state against enemy fighter power
 */
export async function calcFleetAirState(
  deckId: number,
  enemyFP: number
): Promise<AirStateResult | null> {
  const fleetFP = await getFleetFighterPower(deckId);
  if (!fleetFP) return null;

  return calcAirStateResult(fleetFP.totalFighterPower, enemyFP);
}

/**
 * Get fighter power for all fleets
 */
export async function getAllFleetsFighterPower(): Promise<FleetFighterPower[]> {
  const results: FleetFighterPower[] = [];

  for (let deckId = 1; deckId <= 4; deckId++) {
    const fp = await getFleetFighterPower(deckId);
    if (fp && fp.ships.length > 0) {
      results.push(fp);
    }
  }

  return results;
}

/**
 * Get combined fleet fighter power (Fleet 1 + Fleet 2)
 */
export async function getCombinedFleetFighterPower(): Promise<{
  main: FleetFighterPower | null;
  escort: FleetFighterPower | null;
  combined: FleetFighterPower;
}> {
  const main = await getFleetFighterPower(1);
  const escort = await getFleetFighterPower(2);

  const combinedShips: ShipFighterPower[] = [];
  let total = 0;
  let totalMin = 0;
  let totalMax = 0;

  if (main) {
    combinedShips.push(...main.ships);
    total += main.totalFighterPower;
    totalMin += main.totalFighterPowerMin;
    totalMax += main.totalFighterPowerMax;
  }

  if (escort) {
    combinedShips.push(...escort.ships);
    total += escort.totalFighterPower;
    totalMin += escort.totalFighterPowerMin;
    totalMax += escort.totalFighterPowerMax;
  }

  return {
    main,
    escort,
    combined: {
      deckId: 0, // Use 0 to represent combined fleet
      ships: combinedShips,
      totalFighterPower: total,
      totalFighterPowerMin: totalMin,
      totalFighterPowerMax: totalMax,
    },
  };
}
