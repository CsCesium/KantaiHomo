/**
 * Bridge between GameState and the battle scenario calculator.
 *
 * Collects one ship's stats, equipment master stats and fleet context from
 * the in-memory game state and feeds them to buildShipBattleScenarios().
 */

import {
  ScenarioEquip,
  ShipBattleScenarios,
  ShipScenarioInput,
  buildShipBattleScenarios,
} from '../calc';
import { getGameState } from '../state';
import type { GameState, ShipState } from '../state';
import { SlotItemEquipType } from '../../domain/models';

/** Scenario data resolved for the panel, with header context. */
export interface ShipScenarioData {
  shipName: string;
  level: number;
  isFlagship: boolean;
  /** Displayed stats used as calculation base */
  firepower: number;
  torpedo: number;
  luck: number;
  scenarios: ShipBattleScenarios;
}

function isReconPlane(equipType: number): boolean {
  return equipType === SlotItemEquipType.CarrierRecon
    || equipType === SlotItemEquipType.CarrierReconII
    || equipType === SlotItemEquipType.SeaplaneRecon;
}

function isRadar(equipType: number): boolean {
  return equipType === SlotItemEquipType.SmallRadar
    || equipType === SlotItemEquipType.LargeRadar
    || equipType === SlotItemEquipType.LargeRadarII;
}

function isSearchlight(equipType: number): boolean {
  return equipType === SlotItemEquipType.Searchlight
    || equipType === SlotItemEquipType.LargeSearchlight;
}

function activeSlotUids(ship: ShipState): number[] {
  const uids = ship.slots.slice(0, ship.slotCount);
  if (ship.exSlot > 0) uids.push(ship.exSlot);
  return uids.filter(uid => uid > 0);
}

function toScenarioEquip(slotUid: number, onslot: number, st: Readonly<GameState>): ScenarioEquip | null {
  const masterId = st.slotItemIndex.get(slotUid);
  if (masterId === undefined) return null;
  return {
    equipType: st.slotItemEquipTypes.get(masterId) ?? 0,
    iconType: st.slotItemIconTypes.get(masterId) ?? 0,
    firepower: st.slotItemFire.get(masterId) ?? 0,
    torpedo: st.slotItemTorp.get(masterId) ?? 0,
    bomb: st.slotItemBomb.get(masterId) ?? 0,
    los: st.slotItemLos.get(masterId) ?? 0,
    level: st.slotItemLevels.get(slotUid) ?? 0,
    onslot,
  };
}

function collectEquips(ship: ShipState, st: Readonly<GameState>): ScenarioEquip[] {
  const equips: ScenarioEquip[] = [];
  for (let i = 0; i < ship.slotCount; i++) {
    const uid = ship.slots[i] ?? -1;
    if (uid <= 0) continue;
    const equip = toScenarioEquip(uid, i < ship.onslot.length ? ship.onslot[i] : 0, st);
    if (equip !== null) equips.push(equip);
  }
  if (ship.exSlot > 0) {
    const equip = toScenarioEquip(ship.exSlot, 0, st);
    if (equip !== null) equips.push(equip);
  }
  return equips;
}

/**
 * Fleet LoS term of the 弾着観測射撃 rate model:
 * Σ(偵察機索敵×2) + Σ(電探索敵) + Σ⌊√(各艦素索敵)⌋
 */
function calcFleetLoSTerm(fleetShips: ReadonlyArray<ShipState>, st: Readonly<GameState>): number {
  let term = 0;
  for (const ship of fleetShips) {
    let equipLoS = 0;
    for (const slotUid of activeSlotUids(ship)) {
      const masterId = st.slotItemIndex.get(slotUid);
      if (masterId === undefined) continue;
      const los = st.slotItemLos.get(masterId) ?? 0;
      const equipType = st.slotItemEquipTypes.get(masterId) ?? 0;
      equipLoS += los;
      if (isReconPlane(equipType)) {
        term += los * 2;
      } else if (isRadar(equipType)) {
        term += los;
      }
    }
    term += Math.floor(Math.sqrt(Math.max(0, ship.scoutCur - equipLoS)));
  }
  return Math.floor(term);
}

function fleetHasEquip(
  fleetShips: ReadonlyArray<ShipState>,
  st: Readonly<GameState>,
  predicate: (equipType: number) => boolean,
): boolean {
  for (const ship of fleetShips) {
    for (const slotUid of activeSlotUids(ship)) {
      const masterId = st.slotItemIndex.get(slotUid);
      if (masterId === undefined) continue;
      if (predicate(st.slotItemEquipTypes.get(masterId) ?? 0)) return true;
    }
  }
  return false;
}

/**
 * Build the battle scenario table for a ship by uid.
 * Returns null when the ship is unknown.
 */
export function buildShipScenarioData(uid: number): ShipScenarioData | null {
  const manager = getGameState();
  const st = manager.getState();
  const ship = st.ships.get(uid);
  if (!ship) return null;

  const deck = st.decks.find(d => d.shipUids.indexOf(uid) >= 0);
  const fleetShips: ShipState[] = deck
    ? deck.shipUids
      .filter(shipUid => shipUid > 0)
      .map(shipUid => st.ships.get(shipUid))
      .filter((s): s is ShipState => s !== undefined)
    : [ship];
  const isFlagship = deck ? deck.shipUids[0] === uid : false;

  const input: ShipScenarioInput = {
    stype: st.shipMasterStype.get(ship.masterId) ?? 0,
    level: ship.level,
    luck: ship.luckCur,
    firepower: ship.fireCur,
    torpedo: ship.torpCur,
    isFlagship,
    hpNow: ship.hpNow,
    hpMax: ship.hpMax,
    equips: collectEquips(ship, st),
    fleetLoSTerm: calcFleetLoSTerm(fleetShips, st),
    airState: 'supremacy',
    fleetSearchlight: fleetHasEquip(fleetShips, st, isSearchlight),
    fleetStarShell: fleetHasEquip(fleetShips, st, t => t === SlotItemEquipType.Flare),
  };

  return {
    shipName: ship.name,
    level: ship.level,
    isFlagship,
    firepower: ship.fireCur,
    torpedo: ship.torpCur,
    luck: ship.luckCur,
    scenarios: buildShipBattleScenarios(input),
  };
}
