import { ShipSpeed, ShipRange, EquipSlots, ExSlot, RarityCode, ShipStatBlock } from "../api/ship";

export interface Ship {
  uid: number;
  sortNo: number;
  masterId: number;
  level: number;

  expTotal: number;
  expToNext: number;
  expGauge: number;

  hpNow: number;
  hpMax: number;

  speed: ShipSpeed;
  range: ShipRange;

  slots: EquipSlots;
  onslot: number[];
  exSlot: ExSlot;
  slotCount: number;

  mod: { firepower: number; torpedo: number; antiAir: number; armor: number; luck: number; hp: number; asw: number; };

  rarity: RarityCode;

  fuel: number;
  ammo: number;

  ndock: { timeMs: number; cost: { fuel: number; steel: number } };

  stars: number;
  cond: number;

  stats: ShipStatBlock;

  locked: boolean;
  lockedEquip: boolean;

  sallyArea?: number;
  updatedAt: number;
}