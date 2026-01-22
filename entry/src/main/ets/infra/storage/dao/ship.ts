import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { ShipMasterRow, ShipRow } from "../repo/types";
import { relationalStore } from "@kit.ArkData";

export type ShipMasterDbWrite =
  Omit<ShipMasterRow,
  'stype' | 'ctype' | 'speed' | 'range' | 'slotNum' |
  'maxEqJson' | 'afterLv' | 'afterShipId'
  > & {
    stype: number | null;
    ctype: number | null;
    speed: number | null;
    range: number | null;
    slotNum: number | null;

    maxEqJson: string | null;
    afterLv: number | null;
    afterShipId: number | null;
  };

export type ShipDbWrite =
  Omit<ShipRow, 'locked' | 'lockedEquip' | 'sallyArea'> & {
    locked: 0 | 1;
    lockedEquip: 0 | 1;
    sallyArea: number | null;
  };

export interface ShipJoinedDbRow {
  // ship
  uid: number;
  sortNo: number;
  masterId: number;
  level: number;
  expTotal: number;
  expToNext: number;
  expGauge: number;
  nowHp: number;
  maxHp: number;
  speed: number;
  range: number;
  slotsJson: string;
  onslotJson: string;
  slotEx: number;

  modern_fp: number;
  modern_tp: number;
  modern_aa: number;
  modern_ar: number;
  modern_luck: number;
  modern_hp: number;
  modern_asw: number;

  backs: number;
  fuel: number;
  bull: number;
  slotnum: number;

  ndockTime: number;
  ndockFuel: number;
  ndockSteel: number;

  srate: number;
  cond: number;

  fp_cur: number; fp_max: number;
  tp_cur: number; tp_max: number;
  aa_cur: number; aa_max: number;
  ar_cur: number; ar_max: number;
  ev_cur: number; ev_max: number;
  asw_cur: number; asw_max: number;
  sc_cur: number; sc_max: number;
  luck_cur: number; luck_max: number;

  locked: number;
  lockedEquip: number;
  sallyArea: number | null;

  shipUpdatedAt: number;

  // mst (nullable)
  mst_id: number | null;
  mst_sortNo: number | null;
  mst_name: string | null;
  mst_stype: number | null;
  mst_ctype: number | null;
  mst_speed: number | null;
  mst_range: number | null;
  mst_slotNum: number | null;
  mst_maxEqJson: string | null;
  mst_afterLv: number | null;
  mst_afterShipId: number | null;
  mst_updatedAt: number | null;
}

const mapJoined = (rs: relationalStore.ResultSet): ShipJoinedDbRow => ({
  uid: int(rs, 'uid') ?? 0,
  sortNo: int(rs, 'sortNo') ?? 0,
  masterId: int(rs, 'masterId') ?? 0,
  level: int(rs, 'level') ?? 0,
  expTotal: int(rs, 'expTotal') ?? 0,
  expToNext: int(rs, 'expToNext') ?? 0,
  expGauge: int(rs, 'expGauge') ?? 0,
  nowHp: int(rs, 'nowHp') ?? 0,
  maxHp: int(rs, 'maxHp') ?? 0,
  speed: int(rs, 'speed') ?? 0,
  range: int(rs, 'range') ?? 0,
  slotsJson: str(rs, 'slotsJson') ?? '[]',
  onslotJson: str(rs, 'onslotJson') ?? '[]',
  slotEx: int(rs, 'slotEx') ?? 0,

  modern_fp: int(rs, 'modern_fp') ?? 0,
  modern_tp: int(rs, 'modern_tp') ?? 0,
  modern_aa: int(rs, 'modern_aa') ?? 0,
  modern_ar: int(rs, 'modern_ar') ?? 0,
  modern_luck: int(rs, 'modern_luck') ?? 0,
  modern_hp: int(rs, 'modern_hp') ?? 0,
  modern_asw: int(rs, 'modern_asw') ?? 0,

  backs: int(rs, 'backs') ?? 0,
  fuel: int(rs, 'fuel') ?? 0,
  bull: int(rs, 'bull') ?? 0,
  slotnum: int(rs, 'slotnum') ?? 0,

  ndockTime: int(rs, 'ndockTime') ?? 0,
  ndockFuel: int(rs, 'ndockFuel') ?? 0,
  ndockSteel: int(rs, 'ndockSteel') ?? 0,

  srate: int(rs, 'srate') ?? 0,
  cond: int(rs, 'cond') ?? 0,

  fp_cur: int(rs, 'fp_cur') ?? 0, fp_max: int(rs, 'fp_max') ?? 0,
  tp_cur: int(rs, 'tp_cur') ?? 0, tp_max: int(rs, 'tp_max') ?? 0,
  aa_cur: int(rs, 'aa_cur') ?? 0, aa_max: int(rs, 'aa_max') ?? 0,
  ar_cur: int(rs, 'ar_cur') ?? 0, ar_max: int(rs, 'ar_max') ?? 0,
  ev_cur: int(rs, 'ev_cur') ?? 0, ev_max: int(rs, 'ev_max') ?? 0,
  asw_cur: int(rs, 'asw_cur') ?? 0, asw_max: int(rs, 'asw_max') ?? 0,
  sc_cur: int(rs, 'sc_cur') ?? 0, sc_max: int(rs, 'sc_max') ?? 0,
  luck_cur: int(rs, 'luck_cur') ?? 0, luck_max: int(rs, 'luck_max') ?? 0,

  locked: int(rs, 'locked') ?? 0,
  lockedEquip: int(rs, 'lockedEquip') ?? 0,
  sallyArea: int(rs, 'sallyArea') ?? null,

  shipUpdatedAt: int(rs, 'shipUpdatedAt') ?? 0,

  mst_id: int(rs, 'mst_id') ?? null,
  mst_sortNo: int(rs, 'mst_sortNo') ?? null,
  mst_name: str(rs, 'mst_name') ?? null,
  mst_stype: int(rs, 'mst_stype') ?? null,
  mst_ctype: int(rs, 'mst_ctype') ?? null,
  mst_speed: int(rs, 'mst_speed') ?? null,
  mst_range: int(rs, 'mst_range') ?? null,
  mst_slotNum: int(rs, 'mst_slotNum') ?? null,
  mst_maxEqJson: str(rs, 'mst_maxEqJson') ?? null,
  mst_afterLv: int(rs, 'mst_afterLv') ?? null,
  mst_afterShipId: int(rs, 'mst_afterShipId') ?? null,
  mst_updatedAt: int(rs, 'mst_updatedAt') ?? null,
});

export async function upsertMasterBatch(rows: ReadonlyArray<ShipMasterDbWrite>): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO ship_mst
         (id, sortNo, name, stype, ctype, speed, range, slotNum, maxEqJson, afterLv, afterShipId, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.sortNo, r.name,
          r.stype, r.ctype, r.speed, r.range, r.slotNum,
          r.maxEqJson,
          r.afterLv, r.afterShipId,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function upsertBatch(rows: ReadonlyArray<ShipDbWrite>): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO ships (
           uid, sortNo, masterId,
           level, expTotal, expToNext, expGauge,
           nowHp, maxHp, speed, range,
           slotsJson, onslotJson, slotEx,
           modern_fp, modern_tp, modern_aa, modern_ar, modern_luck, modern_hp, modern_asw,
           backs, fuel, bull, slotnum,
           ndockTime, ndockFuel, ndockSteel,
           srate, cond,
           fp_cur, fp_max, tp_cur, tp_max, aa_cur, aa_max, ar_cur, ar_max, ev_cur, ev_max, asw_cur, asw_max, sc_cur, sc_max, luck_cur, luck_max,
           locked, lockedEquip, sallyArea,
           updatedAt
         ) VALUES (
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?,
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?
         )`,
        [
          r.uid, r.sortNo, r.masterId,
          r.level, r.expTotal, r.expToNext, r.expGauge,
          r.nowHp, r.maxHp, r.speed, r.range,
          r.slotsJson, r.onslotJson, r.slotEx,
          r.modern_fp, r.modern_tp, r.modern_aa, r.modern_ar, r.modern_luck, r.modern_hp, r.modern_asw,
          r.backs, r.fuel, r.bull, r.slotnum,
          r.ndockTime, r.ndockFuel, r.ndockSteel,
          r.srate, r.cond,
          r.fp_cur, r.fp_max, r.tp_cur, r.tp_max, r.aa_cur, r.aa_max, r.ar_cur, r.ar_max, r.ev_cur, r.ev_max, r.asw_cur, r.asw_max, r.sc_cur, r.sc_max, r.luck_cur, r.luck_max,
          r.locked, r.lockedEquip, r.sallyArea,
          r.updatedAt,
        ]
      );
    }
  });
}

const BASE_JOIN_SQL = `
  SELECT
    s.uid AS uid,
    s.sortNo AS sortNo,
    s.masterId AS masterId,
    s.level AS level,
    s.expTotal AS expTotal,
    s.expToNext AS expToNext,
    s.expGauge AS expGauge,
    s.nowHp AS nowHp,
    s.maxHp AS maxHp,
    s.speed AS speed,
    s.range AS range,
    s.slotsJson AS slotsJson,
    s.onslotJson AS onslotJson,
    s.slotEx AS slotEx,

    s.modern_fp AS modern_fp,
    s.modern_tp AS modern_tp,
    s.modern_aa AS modern_aa,
    s.modern_ar AS modern_ar,
    s.modern_luck AS modern_luck,
    s.modern_hp AS modern_hp,
    s.modern_asw AS modern_asw,

    s.backs AS backs,
    s.fuel AS fuel,
    s.bull AS bull,
    s.slotnum AS slotnum,

    s.ndockTime AS ndockTime,
    s.ndockFuel AS ndockFuel,
    s.ndockSteel AS ndockSteel,

    s.srate AS srate,
    s.cond AS cond,

    s.fp_cur AS fp_cur, s.fp_max AS fp_max,
    s.tp_cur AS tp_cur, s.tp_max AS tp_max,
    s.aa_cur AS aa_cur, s.aa_max AS aa_max,
    s.ar_cur AS ar_cur, s.ar_max AS ar_max,
    s.ev_cur AS ev_cur, s.ev_max AS ev_max,
    s.asw_cur AS asw_cur, s.asw_max AS asw_max,
    s.sc_cur AS sc_cur, s.sc_max AS sc_max,
    s.luck_cur AS luck_cur, s.luck_max AS luck_max,

    s.locked AS locked,
    s.lockedEquip AS lockedEquip,
    s.sallyArea AS sallyArea,
    s.updatedAt AS shipUpdatedAt,

    m.id AS mst_id,
    m.sortNo AS mst_sortNo,
    m.name AS mst_name,
    m.stype AS mst_stype,
    m.ctype AS mst_ctype,
    m.speed AS mst_speed,
    m.range AS mst_range,
    m.slotNum AS mst_slotNum,
    m.maxEqJson AS mst_maxEqJson,
    m.afterLv AS mst_afterLv,
    m.afterShipId AS mst_afterShipId,
    m.updatedAt AS mst_updatedAt
  FROM ships s
  LEFT JOIN ship_mst m ON m.id = s.masterId
`;

export async function listWithMaster(): Promise<ShipJoinedDbRow[]> {
  const rs = await query(`${BASE_JOIN_SQL} ORDER BY s.uid ASC`, []);
  return readRows(rs, mapJoined);
}

export async function getWithMaster(uid: number): Promise<ShipJoinedDbRow | null> {
  const rs = await query(`${BASE_JOIN_SQL} WHERE s.uid = ? LIMIT 1`, [uid]);
  return readOne(rs, mapJoined);
}