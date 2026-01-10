import type { StatPair } from '../common';

export enum ShipSpeed {
  BASE = 0,
  LOW = 5,
  HIGH = 10,
  HIGH_PLUS = 15,
  FASTEST = 20,
  MANBO = 25,
}

export enum ShipRange {
  NONE = 0,
  SHORT = 1,
  MEDIUM = 2,
  LONG = 3,
  VERY_LONG = 4,
  VERY_LONG_PLUS = 5,
}

export type ExpTuple = [total: number, toNext: number, gauge: number];

export type ModernizationTuple =
  [fp: number, tp: number, aa: number, ar: number, luck: number, hp: number, asw: number];

export type NdockItemTuple = [fuel: number, steel: number];

export type EquipSlotId = number; // -1=空
export type EquipSlots = EquipSlotId[];
export type ExSlot = 0 | -1 | number; // 0未解放, -1未装备, >0=装备ID
export type RarityCode = number;

export interface ApiShipRaw {
  api_id: number;
  api_sortno: number;
  api_ship_id: number;
  api_lv: number;
  api_exp: ExpTuple;
  api_nowhp: number;
  api_maxhp: number;
  api_soku: ShipSpeed;
  api_leng: ShipRange;
  api_slot: EquipSlots;
  api_onslot: number[];
  api_slot_ex: ExSlot;
  api_kyouka: ModernizationTuple;
  api_backs: RarityCode;
  api_fuel: number;
  api_bull: number;
  api_slotnum: number;
  api_ndock_time: number;
  api_ndock_item: NdockItemTuple;
  api_srate: number;
  api_cond: number;

  api_karyoku: [number, number];
  api_raisou: [number, number];
  api_taiku: [number, number];
  api_soukou: [number, number];
  api_kaihi: [number, number];
  api_taisen: [number, number];
  api_sakuteki: [number, number];
  api_lucky: [number, number];

  api_locked: 0 | 1;
  api_locked_equip: 0 | 1;
  api_sally_area?: number;
}

export interface ShipStatBlock {
  firepower: StatPair; torpedo: StatPair; antiAir: StatPair; armor: StatPair;
  evasion: StatPair; asw: StatPair; scout: StatPair; luck: StatPair;
}