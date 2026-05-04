/**
 * Fleet Fighter Power Calculator Service
 *
 * Reads fleet/ship/equipment data from the in-memory GameState — the same
 * source the panel UI uses via getDeckShips(). Equipment master data
 * (aa, equipType, name) is sourced from caches populated by api_start2.
 * This avoids the SQLite races / missing-persistence issues that left
 * the 制空 panel stuck at 0.
 */

import {
  SlotItemMaster,
  SlotItemMajorType,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemAircraftCategory,
} from '../../../domain/models';
import {
  calcSlotFighterPower,
  calcAirStateResult,
  isAirCombatEquip,
  SlotFighterPower,
  ShipFighterPower,
  FleetFighterPower,
  AirStateResult,
} from './fighter_power';
import {
  getDeck,
  getShip,
  getGameState,
  getSlotItemLevel,
  getSlotItemAlv,
  getSlotItemMasterAa,
  getSlotItemMasterEquipType,
  getSlotItemMasterName,
} from '../../state';

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
 * Build a minimal SlotItemMaster from in-memory caches.
 * Only the fields read by calcSlotFighterPower (id, name, type.equipType,
 * stats.aa) carry real data; everything else is filled with zero defaults.
 */
function masterFromCache(masterId: number): SlotItemMaster {
  const equipType = getSlotItemMasterEquipType(masterId) as SlotItemEquipType;
  return {
    id: masterId,
    sortNo: 0,
    name: getSlotItemMasterName(masterId) || `Equip#${masterId}`,
    type: {
      major: 0 as SlotItemMajorType,
      book: 0 as SlotItemBookCategory,
      equipType,
      iconId: 0 as SlotItemIconId,
      aircraft: 0 as SlotItemAircraftCategory,
    },
    rarity: 0,
    range: 0,
    stats: {
      hp: 0, armor: 0, firepower: 0, torpedo: 0, speed: 0, bomb: 0,
      aa: getSlotItemMasterAa(masterId),
      asw: 0, hit: 0, evasion: 0, los: 0, luck: 0,
    },
    broken: [0, 0, 0, 0],
    updatedAt: 0,
  };
}

/**
 * Get ship equipment info from in-memory game state.
 */
export function getShipEquipInfo(shipUid: number): ShipEquipInfo | null {
  const ship = getShip(shipUid);
  if (!ship) return null;

  const slotIndex = getGameState().getState().slotItemIndex;

  const slots: SlotInfo[] = [];
  for (let i = 0; i < ship.slotCount; i++) {
    const uid = ship.slots[i];
    const slotSize = ship.onslot[i] || 0;
    if (uid <= 0) {
      slots.push({ equipUid: uid, slotSize, master: undefined, level: 0, proficiency: 0 });
      continue;
    }
    const masterId = slotIndex.get(uid);
    const master = masterId !== undefined ? masterFromCache(masterId) : undefined;
    slots.push({
      equipUid: uid,
      slotSize,
      master,
      level: getSlotItemLevel(uid),
      proficiency: getSlotItemAlv(uid),
    });
  }

  let exSlot: SlotInfo | undefined;
  if (ship.exSlot > 0) {
    const masterId = slotIndex.get(ship.exSlot);
    exSlot = {
      equipUid: ship.exSlot,
      slotSize: 0,
      master: masterId !== undefined ? masterFromCache(masterId) : undefined,
      level: getSlotItemLevel(ship.exSlot),
      proficiency: getSlotItemAlv(ship.exSlot),
    };
  }

  return {
    shipUid,
    shipMasterId: ship.masterId,
    shipName: ship.name || `Ship#${ship.masterId}`,
    slots,
    exSlot,
  };
}

/**
 * Get fleet equipment info from in-memory game state.
 */
export function getFleetEquipInfo(deckId: number): FleetEquipInfo | null {
  const deck = getDeck(deckId);
  if (!deck) return null;

  const ships: ShipEquipInfo[] = [];
  for (const shipUid of deck.shipUids) {
    if (shipUid <= 0) continue;
    const shipInfo = getShipEquipInfo(shipUid);
    if (shipInfo) ships.push(shipInfo);
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
