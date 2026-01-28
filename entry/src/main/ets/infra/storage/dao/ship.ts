import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { relationalStore } from "@kit.ArkData";
import { ShipJoinedRow, ShipMasterRow, ShipRow } from "../types";

// ==================== Row Mappers ====================

const mapShipRow = (rs: relationalStore.ResultSet): ShipRow => ({
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

  fp_cur: int(rs, 'fp_cur') ?? 0,
  fp_max: int(rs, 'fp_max') ?? 0,
  tp_cur: int(rs, 'tp_cur') ?? 0,
  tp_max: int(rs, 'tp_max') ?? 0,
  aa_cur: int(rs, 'aa_cur') ?? 0,
  aa_max: int(rs, 'aa_max') ?? 0,
  ar_cur: int(rs, 'ar_cur') ?? 0,
  ar_max: int(rs, 'ar_max') ?? 0,
  ev_cur: int(rs, 'ev_cur') ?? 0,
  ev_max: int(rs, 'ev_max') ?? 0,
  asw_cur: int(rs, 'asw_cur') ?? 0,
  asw_max: int(rs, 'asw_max') ?? 0,
  sc_cur: int(rs, 'sc_cur') ?? 0,
  sc_max: int(rs, 'sc_max') ?? 0,
  luck_cur: int(rs, 'luck_cur') ?? 0,
  luck_max: int(rs, 'luck_max') ?? 0,

  locked: int(rs, 'locked') ?? 0,
  lockedEquip: int(rs, 'lockedEquip') ?? 0,
  sallyArea: int(rs, 'sallyArea'),

  updatedAt: int(rs, 'updatedAt') ?? 0,
});

const mapMasterRow = (rs: relationalStore.ResultSet): ShipMasterRow => ({
  id: int(rs, 'id') ?? 0,
  sortNo: int(rs, 'sortNo') ?? 0,
  name: str(rs, 'name') ?? '',
  stype: int(rs, 'stype'),
  ctype: int(rs, 'ctype'),
  speed: int(rs, 'speed'),
  range: int(rs, 'range'),
  slotNum: int(rs, 'slotNum'),
  maxEqJson: str(rs, 'maxEqJson'),
  afterLv: int(rs, 'afterLv'),
  afterShipId: int(rs, 'afterShipId'),
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

const mapJoinedRow = (rs: relationalStore.ResultSet): ShipJoinedRow => ({
  // Ship fields
  ...mapShipRow(rs),
  updatedAt: int(rs, 'shipUpdatedAt') ?? int(rs, 'updatedAt') ?? 0,

  // Master fields (prefixed)
  mst_id: int(rs, 'mst_id'),
  mst_sortNo: int(rs, 'mst_sortNo'),
  mst_name: str(rs, 'mst_name'),
  mst_stype: int(rs, 'mst_stype'),
  mst_ctype: int(rs, 'mst_ctype'),
  mst_speed: int(rs, 'mst_speed'),
  mst_range: int(rs, 'mst_range'),
  mst_slotNum: int(rs, 'mst_slotNum'),
  mst_maxEqJson: str(rs, 'mst_maxEqJson'),
  mst_afterLv: int(rs, 'mst_afterLv'),
  mst_afterShipId: int(rs, 'mst_afterShipId'),
  mst_updatedAt: int(rs, 'mst_updatedAt'),
});

// ==================== Master Operations ====================

export async function upsertMasterBatch(rows: readonly ShipMasterRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO ship_mst
         (id, sortNo, name, stype, ctype, speed, range, slotNum, maxEqJson, afterLv, afterShipId, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.sortNo,
          r.name,
          r.stype,
          r.ctype,
          r.speed,
          r.range,
          r.slotNum,
          r.maxEqJson,
          r.afterLv,
          r.afterShipId,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function getMaster(id: number): Promise<ShipMasterRow | null> {
  const rs = await query(
    `SELECT id, sortNo, name, stype, ctype, speed, range, slotNum, maxEqJson, afterLv, afterShipId, updatedAt
     FROM ship_mst WHERE id = ? LIMIT 1`,
    [id]
  );
  return readOne(rs, mapMasterRow);
}

export async function listMasters(): Promise<ShipMasterRow[]> {
  const rs = await query(
    `SELECT id, sortNo, name, stype, ctype, speed, range, slotNum, maxEqJson, afterLv, afterShipId, updatedAt
     FROM ship_mst ORDER BY id ASC`,
    []
  );
  return readRows(rs, mapMasterRow);
}

// ==================== Ship Operations ====================

export async function upsertBatch(rows: readonly ShipRow[]): Promise<void> {
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
           fp_cur, fp_max, tp_cur, tp_max, aa_cur, aa_max, ar_cur, ar_max,
           ev_cur, ev_max, asw_cur, asw_max, sc_cur, sc_max, luck_cur, luck_max,
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
           ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?, ?,
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
          r.fp_cur, r.fp_max, r.tp_cur, r.tp_max, r.aa_cur, r.aa_max, r.ar_cur, r.ar_max,
          r.ev_cur, r.ev_max, r.asw_cur, r.asw_max, r.sc_cur, r.sc_max, r.luck_cur, r.luck_max,
          r.locked, r.lockedEquip, r.sallyArea,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function get(uid: number): Promise<ShipRow | null> {
  const rs = await query(
    `SELECT * FROM ships WHERE uid = ? LIMIT 1`,
    [uid]
  );
  return readOne(rs, mapShipRow);
}

export async function listAll(): Promise<ShipRow[]> {
  const rs = await query(`SELECT * FROM ships ORDER BY uid ASC`, []);
  return readRows(rs, mapShipRow);
}

export async function deleteByUid(uid: number): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(`DELETE FROM ships WHERE uid = ?`, [uid]);
  });
}

export async function deleteByUids(uids: readonly number[]): Promise<void> {
  if (!uids.length) return;
  const marks = uids.map(() => '?').join(',');
  await withTransaction(async (db) => {
    await db.executeSql(`DELETE FROM ships WHERE uid IN (${marks})`, [...uids]);
  });
}

// ==================== JOIN Operations ====================

const JOIN_SQL = `
  SELECT
    s.uid, s.sortNo, s.masterId,
    s.level, s.expTotal, s.expToNext, s.expGauge,
    s.nowHp, s.maxHp, s.speed, s.range,
    s.slotsJson, s.onslotJson, s.slotEx,
    s.modern_fp, s.modern_tp, s.modern_aa, s.modern_ar, s.modern_luck, s.modern_hp, s.modern_asw,
    s.backs, s.fuel, s.bull, s.slotnum,
    s.ndockTime, s.ndockFuel, s.ndockSteel,
    s.srate, s.cond,
    s.fp_cur, s.fp_max, s.tp_cur, s.tp_max, s.aa_cur, s.aa_max, s.ar_cur, s.ar_max,
    s.ev_cur, s.ev_max, s.asw_cur, s.asw_max, s.sc_cur, s.sc_max, s.luck_cur, s.luck_max,
    s.locked, s.lockedEquip, s.sallyArea,
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

export async function getWithMaster(uid: number): Promise<ShipJoinedRow | null> {
  const rs = await query(`${JOIN_SQL} WHERE s.uid = ? LIMIT 1`, [uid]);
  return readOne(rs, mapJoinedRow);
}

export async function listWithMaster(): Promise<ShipJoinedRow[]> {
  const rs = await query(`${JOIN_SQL} ORDER BY s.uid ASC`, []);
  return readRows(rs, mapJoinedRow);
}

export async function listWithMasterByUids(uids: readonly number[]): Promise<ShipJoinedRow[]> {
  if (!uids.length) return [];
  const marks = uids.map(() => '?').join(',');
  const rs = await query(`${JOIN_SQL} WHERE s.uid IN (${marks})`, [...uids]);
  return readRows(rs, mapJoinedRow);
}
