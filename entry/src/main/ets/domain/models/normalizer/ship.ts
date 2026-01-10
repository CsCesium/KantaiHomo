import type { StatPair } from '../models/common';
import type { ApiShipRaw } from '../models/api/ship';
import type { Ship } from '../models/ship';

export function normalizeShip(raw: ApiShipRaw, now: number = Date.now()): Ship {
  const [expTotal, expToNext, expGauge] = raw.api_exp;
  const [modFp, modTp, modAa, modAr, modLuck, modHp, modAsw] = raw.api_kyouka;
  const [dockFuel, dockSteel] = raw.api_ndock_item;

  const toPair = (p: [number, number]): StatPair => ({ current: p?.[0] ?? 0, max: p?.[1] ?? 0 });

  return {
    uid: raw.api_id,
    sortNo: raw.api_sortno,
    masterId: raw.api_ship_id,
    level: raw.api_lv,

    expTotal, expToNext, expGauge,

    hpNow: raw.api_nowhp,
    hpMax: raw.api_maxhp,

    speed: raw.api_soku,
    range: raw.api_leng,

    slots: raw.api_slot ?? [],
    onslot: raw.api_onslot ?? [],
    exSlot: raw.api_slot_ex,
    slotCount: raw.api_slotnum,

    mod: { firepower: modFp, torpedo: modTp, antiAir: modAa, armor: modAr, luck: modLuck, hp: modHp, asw: modAsw },

    rarity: raw.api_backs,

    fuel: raw.api_fuel,
    ammo: raw.api_bull,

    ndock: { timeMs: raw.api_ndock_time, cost: { fuel: dockFuel, steel: dockSteel } },

    stars: raw.api_srate,
    cond: raw.api_cond,

    stats: {
      firepower: toPair(raw.api_karyoku),
      torpedo: toPair(raw.api_raisou),
      antiAir: toPair(raw.api_taiku),
      armor: toPair(raw.api_soukou),
      evasion: toPair(raw.api_kaihi),
      asw: toPair(raw.api_taisen),
      scout: toPair(raw.api_sakuteki),
      luck: toPair(raw.api_lucky),
    },

    locked: raw.api_locked === 1,
    lockedEquip: raw.api_locked_equip === 1,

    sallyArea: raw.api_sally_area,

    updatedAt: now,
  };
}