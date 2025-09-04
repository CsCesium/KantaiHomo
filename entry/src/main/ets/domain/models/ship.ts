import type { StatPair } from './common';

export enum ShipSpeed {
  BASE = 0, //default，基地
  LOW = 5, //低速
  HIGH = 10, //高速
  HIGH_PLUS = 15, //高速+
  FASTEST = 20, //最速
  MANBO = 25, //最速+？
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

export type EquipSlotId = number; // -1 = 空

export type EquipSlots = EquipSlotId[];

export type ExSlot = 0 | -1 | number; //0=未解放, -1=未装备, >0=装备ID

export type RarityCode = number;

export interface ApiShipRaw {
  api_id: number; // 艦船固有ID（唯一）
  api_sortno: number; // 図鑑番号
  api_ship_id: number; // 艦船ID（master id）
  api_lv: number; // Lv
  api_exp: ExpTuple; // 经验 [累积, 下一级所需, 经验条]
  api_nowhp: number; // 当前HP
  api_maxhp: number; // 最大HP
  api_soku: ShipSpeed; // 速力
  api_leng: ShipRange; // 射程
  api_slot: EquipSlots; // 装备槽：-1=空
  api_onslot: number[]; // 艦載機搭載数（与机库位对应）
  api_slot_ex: ExSlot; // 补强槽：0未解放, -1未装备, >0装备ID
  api_kyouka: ModernizationTuple; // 近代化改修
  api_backs: RarityCode; // 稀有度
  api_fuel: number; // 搭载燃料
  api_bull: number; // 搭载弹药
  api_slotnum: number; // 槽位数
  api_ndock_time: number; // 入渠时间(ms)
  api_ndock_item: NdockItemTuple; // 入渠消耗 [燃料, 钢材]
  api_srate: number; // 改装☆（强化星？）
  api_cond: number; // 疲劳（コンディション）
  api_karyoku: [number, number]; // 火力 [当前(含装), 最大]
  api_raisou: [number, number]; // 雷装 [当前(含装), 最大]
  api_taiku: [number, number]; // 对空
  api_soukou: [number, number]; // 装甲
  api_kaihi: [number, number]; // 回避
  api_taisen: [number, number]; // 对潜
  api_sakuteki: [number, number]; // 索敌
  api_lucky: [number, number]; // 运 [当前(含装), 最大]
  api_locked: 0 | 1; // 舰锁
  api_locked_equip: 0 | 1; // 是否装备了“锁定的装备”
  api_sally_area?: number; // 出撃海域（活动期存在）
}

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
  stats: {
    firepower: StatPair; torpedo: StatPair; antiAir: StatPair; armor: StatPair;
    evasion: StatPair; asw: StatPair; scout: StatPair; luck: StatPair;
  };
  locked: boolean;
  lockedEquip: boolean;
  sallyArea?: number;
  updatedAt: number;
}

export function normalizeShip(raw: ApiShipRaw): Ship {
  const [expTotal, expToNext, expGauge] = raw.api_exp;
  const [modFp, modTp, modAa, modAr, modLuck, modHp, modAsw] = raw.api_kyouka;
  const [dockFuel, dockSteel] = raw.api_ndock_item;
  const toPair = (p: [number, number]): StatPair => ({ current: p[0] ?? 0, max: p[1] ?? 0 });

  return {
    uid: raw.api_id, sortNo: raw.api_sortno, masterId: raw.api_ship_id, level: raw.api_lv,
    expTotal, expToNext, expGauge,
    hpNow: raw.api_nowhp, hpMax: raw.api_maxhp,
    speed: raw.api_soku, range: raw.api_leng,
    slots: raw.api_slot ?? [], onslot: raw.api_onslot ?? [], exSlot: raw.api_slot_ex, slotCount: raw.api_slotnum,
    mod: { firepower:modFp, torpedo:modTp, antiAir:modAa, armor:modAr, luck:modLuck, hp:modHp, asw:modAsw },
    rarity: raw.api_backs,
    fuel: raw.api_fuel, ammo: raw.api_bull,
    ndock: { timeMs: raw.api_ndock_time, cost: { fuel: dockFuel, steel: dockSteel } },
    stars: raw.api_srate, cond: raw.api_cond,
    stats: {
      firepower: toPair(raw.api_karyoku), torpedo: toPair(raw.api_raisou),
      antiAir: toPair(raw.api_taiku),     armor:   toPair(raw.api_soukou),
      evasion:  toPair(raw.api_kaihi),    asw:     toPair(raw.api_taisen),
      scout:    toPair(raw.api_sakuteki), luck:    toPair(raw.api_lucky),
    },
    locked: raw.api_locked === 1, lockedEquip: raw.api_locked_equip === 1,
    sallyArea: raw.api_sally_area,
    updatedAt: Date.now(),
  };
}