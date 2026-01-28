import { ShipRow } from '../../../infra/storage/types';
import { Ship } from '../struct/ship';


/**
 * 将 Ship struct 转换为 ShipRowWrite（用于存储）
 */
export function shipToRow(ship: Ship): ShipRow {
  return {
    uid: ship.uid,
    sortNo: ship.sortNo,
    masterId: ship.masterId,
    level: ship.level,

    expTotal: ship.expTotal,
    expToNext: ship.expToNext,
    expGauge: ship.expGauge,

    nowHp: ship.hpNow,
    maxHp: ship.hpMax,
    speed: ship.speed,
    range: ship.range,

    slotsJson: JSON.stringify(ship.slots),
    onslotJson: JSON.stringify(ship.onslot),
    slotEx: ship.exSlot,

    modern_fp: ship.mod.firepower,
    modern_tp: ship.mod.torpedo,
    modern_aa: ship.mod.antiAir,
    modern_ar: ship.mod.armor,
    modern_luck: ship.mod.luck,
    modern_hp: ship.mod.hp,
    modern_asw: ship.mod.asw,

    backs: ship.rarity,
    fuel: ship.fuel,
    bull: ship.ammo,
    slotnum: ship.slotCount,

    ndockTime: ship.ndock.timeMs,
    ndockFuel: ship.ndock.cost.fuel,
    ndockSteel: ship.ndock.cost.steel,

    srate: ship.stars,
    cond: ship.cond,

    fp_cur: ship.stats.firepower.current,
    fp_max: ship.stats.firepower.max,
    tp_cur: ship.stats.torpedo.current,
    tp_max: ship.stats.torpedo.max,
    aa_cur: ship.stats.antiAir.current,
    aa_max: ship.stats.antiAir.max,
    ar_cur: ship.stats.armor.current,
    ar_max: ship.stats.armor.max,
    ev_cur: ship.stats.evasion.current,
    ev_max: ship.stats.evasion.max,
    asw_cur: ship.stats.asw.current,
    asw_max: ship.stats.asw.max,
    sc_cur: ship.stats.scout.current,
    sc_max: ship.stats.scout.max,
    luck_cur: ship.stats.luck.current,
    luck_max: ship.stats.luck.max,

    locked: ship.locked?1:0,
    lockedEquip: ship.lockedEquip?1:0,
    sallyArea: ship.sallyArea,

    updatedAt: ship.updatedAt,
  };
}

/**
 * 将 ShipRow 转换为 Ship struct（用于业务层）
 */
export function rowToShip(row: ShipRow): Ship {
  return {
    uid: row.uid,
    sortNo: row.sortNo,
    masterId: row.masterId,
    level: row.level,

    expTotal: row.expTotal,
    expToNext: row.expToNext,
    expGauge: row.expGauge,

    hpNow: row.nowHp,
    hpMax: row.maxHp,
    speed: row.speed,
    range: row.range,

    slots: safeParseJsonArray(row.slotsJson),
    onslot: safeParseJsonArray(row.onslotJson),
    exSlot: row.slotEx,
    slotCount: row.slotnum,

    mod: {
      firepower: row.modern_fp,
      torpedo: row.modern_tp,
      antiAir: row.modern_aa,
      armor: row.modern_ar,
      luck: row.modern_luck,
      hp: row.modern_hp,
      asw: row.modern_asw,
    },

    rarity: row.backs,
    fuel: row.fuel,
    ammo: row.bull,

    ndock: {
      timeMs: row.ndockTime,
      cost: { fuel: row.ndockFuel, steel: row.ndockSteel },
    },

    stars: row.srate,
    cond: row.cond,

    stats: {
      firepower: { current: row.fp_cur, max: row.fp_max },
      torpedo: { current: row.tp_cur, max: row.tp_max },
      antiAir: { current: row.aa_cur, max: row.aa_max },
      armor: { current: row.ar_cur, max: row.ar_max },
      evasion: { current: row.ev_cur, max: row.ev_max },
      asw: { current: row.asw_cur, max: row.asw_max },
      scout: { current: row.sc_cur, max: row.sc_max },
      luck: { current: row.luck_cur, max: row.luck_max },
    },

    locked: row.locked===1?? null,
    lockedEquip: row.lockedEquip===1?? null,
    sallyArea: row.sallyArea,

    updatedAt: row.updatedAt,
  };
}

/**
 * 批量转换 Ships
 */
export function shipsToRows(ships: readonly Ship[]): ShipRow[] {
  return ships.map(shipToRow);
}

export function rowsToShips(rows: readonly ShipRow[]): Ship[] {
  return rows.map(rowToShip);
}

// ==================== Helper ====================

function safeParseJsonArray(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
