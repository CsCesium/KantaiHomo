import { int, str, withTransaction, query, readOne, readRows } from "../db";
import { SlotItemRow, SlotItemMasterRow, SlotItemJoinedRow } from "../types";
import { relationalStore } from "@kit.ArkData";

// ==================== Row Mappers ====================

const mapItemRow = (rs: relationalStore.ResultSet): SlotItemRow => ({
  uid: int(rs, 'uid') ?? 0,
  masterId: int(rs, 'masterId') ?? 0,
  locked: int(rs, 'locked') ?? 0,
  level: int(rs, 'level'),
  alv: int(rs, 'alv'),
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

const mapMasterRow = (rs: relationalStore.ResultSet): SlotItemMasterRow => ({
  id: int(rs, 'id') ?? 0,
  sortNo: int(rs, 'sortNo') ?? 0,
  name: str(rs, 'name') ?? '',

  typeMajor: int(rs, 'typeMajor') ?? 0,
  typeBook: int(rs, 'typeBook') ?? 0,
  typeEquipType: int(rs, 'typeEquipType') ?? 0,
  typeIconId: int(rs, 'typeIconId') ?? 0,
  typeAircraft: int(rs, 'typeAircraft') ?? 0,

  rarity: int(rs, 'rarity') ?? 0,
  range: int(rs, 'range') ?? 0,

  stat_hp: int(rs, 'stat_hp') ?? 0,
  stat_armor: int(rs, 'stat_armor') ?? 0,
  stat_firepower: int(rs, 'stat_firepower') ?? 0,
  stat_torpedo: int(rs, 'stat_torpedo') ?? 0,
  stat_speed: int(rs, 'stat_speed') ?? 0,
  stat_bomb: int(rs, 'stat_bomb') ?? 0,
  stat_aa: int(rs, 'stat_aa') ?? 0,
  stat_asw: int(rs, 'stat_asw') ?? 0,
  stat_hit: int(rs, 'stat_hit') ?? 0,
  stat_evasion: int(rs, 'stat_evasion') ?? 0,
  stat_los: int(rs, 'stat_los') ?? 0,
  stat_luck: int(rs, 'stat_luck') ?? 0,

  broken_fuel: int(rs, 'broken_fuel') ?? 0,
  broken_ammo: int(rs, 'broken_ammo') ?? 0,
  broken_steel: int(rs, 'broken_steel') ?? 0,
  broken_bauxite: int(rs, 'broken_bauxite') ?? 0,

  cost: int(rs, 'cost'),
  distance: int(rs, 'distance'),
  useBull: int(rs, 'useBull'),
  gfxVersion: int(rs, 'gfxVersion'),

  updatedAt: int(rs, 'updatedAt') ?? 0,
});

const mapJoinedRow = (rs: relationalStore.ResultSet): SlotItemJoinedRow => ({
  uid: int(rs, 'uid') ?? 0,
  masterId: int(rs, 'masterId') ?? 0,
  locked: int(rs, 'locked') ?? 0,
  level: int(rs, 'level'),
  alv: int(rs, 'alv'),
  updatedAt: int(rs, 'itemUpdatedAt') ?? int(rs, 'updatedAt') ?? 0,

  mst_id: int(rs, 'mst_id'),
  mst_sortNo: int(rs, 'mst_sortNo'),
  mst_name: str(rs, 'mst_name'),

  mst_typeMajor: int(rs, 'mst_typeMajor'),
  mst_typeBook: int(rs, 'mst_typeBook'),
  mst_typeEquipType: int(rs, 'mst_typeEquipType'),
  mst_typeIconId: int(rs, 'mst_typeIconId'),
  mst_typeAircraft: int(rs, 'mst_typeAircraft'),

  mst_rarity: int(rs, 'mst_rarity'),
  mst_range: int(rs, 'mst_range'),

  mst_stat_hp: int(rs, 'mst_stat_hp'),
  mst_stat_armor: int(rs, 'mst_stat_armor'),
  mst_stat_firepower: int(rs, 'mst_stat_firepower'),
  mst_stat_torpedo: int(rs, 'mst_stat_torpedo'),
  mst_stat_speed: int(rs, 'mst_stat_speed'),
  mst_stat_bomb: int(rs, 'mst_stat_bomb'),
  mst_stat_aa: int(rs, 'mst_stat_aa'),
  mst_stat_asw: int(rs, 'mst_stat_asw'),
  mst_stat_hit: int(rs, 'mst_stat_hit'),
  mst_stat_evasion: int(rs, 'mst_stat_evasion'),
  mst_stat_los: int(rs, 'mst_stat_los'),
  mst_stat_luck: int(rs, 'mst_stat_luck'),

  mst_broken_fuel: int(rs, 'mst_broken_fuel'),
  mst_broken_ammo: int(rs, 'mst_broken_ammo'),
  mst_broken_steel: int(rs, 'mst_broken_steel'),
  mst_broken_bauxite: int(rs, 'mst_broken_bauxite'),

  mst_cost: int(rs, 'mst_cost'),
  mst_distance: int(rs, 'mst_distance'),
  mst_useBull: int(rs, 'mst_useBull'),
  mst_gfxVersion: int(rs, 'mst_gfxVersion'),

  mst_updatedAt: int(rs, 'mst_updatedAt'),
});

// ==================== Master Operations ====================

export async function upsertMasterBatch(rows: readonly SlotItemMasterRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO slotitem_mst (
           id, sortNo, name,
           typeMajor, typeBook, typeEquipType, typeIconId, typeAircraft,
           rarity, range,
           stat_hp, stat_armor, stat_firepower, stat_torpedo, stat_speed, stat_bomb,
           stat_aa, stat_asw, stat_hit, stat_evasion, stat_los, stat_luck,
           broken_fuel, broken_ammo, broken_steel, broken_bauxite,
           cost, distance, useBull, gfxVersion,
           updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.sortNo, r.name,
          r.typeMajor, r.typeBook, r.typeEquipType, r.typeIconId, r.typeAircraft,
          r.rarity, r.range,
          r.stat_hp, r.stat_armor, r.stat_firepower, r.stat_torpedo, r.stat_speed, r.stat_bomb,
          r.stat_aa, r.stat_asw, r.stat_hit, r.stat_evasion, r.stat_los, r.stat_luck,
          r.broken_fuel, r.broken_ammo, r.broken_steel, r.broken_bauxite,
          r.cost, r.distance, r.useBull, r.gfxVersion,
          r.updatedAt,
        ]
      );
    }
  });
}

// ==================== Item Operations ====================

export async function upsertBatch(rows: readonly SlotItemRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO slotitems (uid, masterId, locked, level, alv, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.uid, r.masterId, r.locked, r.level, r.alv, r.updatedAt]
      );
    }
  });
}

export async function get(uid: number): Promise<SlotItemRow | null> {
  const rs = await query(`SELECT * FROM slotitems WHERE uid = ? LIMIT 1`, [uid]);
  return readOne(rs, mapItemRow);
}

export async function listAll(): Promise<SlotItemRow[]> {
  const rs = await query(`SELECT * FROM slotitems ORDER BY uid ASC`, []);
  return readRows(rs, mapItemRow);
}

// ==================== JOIN Operations ====================

const JOIN_SQL = `
  SELECT
    s.uid, s.masterId, s.locked, s.level, s.alv,
    s.updatedAt AS itemUpdatedAt,

    m.id AS mst_id,
    m.sortNo AS mst_sortNo,
    m.name AS mst_name,
    m.typeMajor AS mst_typeMajor,
    m.typeBook AS mst_typeBook,
    m.typeEquipType AS mst_typeEquipType,
    m.typeIconId AS mst_typeIconId,
    m.typeAircraft AS mst_typeAircraft,
    m.rarity AS mst_rarity,
    m.range AS mst_range,
    m.stat_hp AS mst_stat_hp,
    m.stat_armor AS mst_stat_armor,
    m.stat_firepower AS mst_stat_firepower,
    m.stat_torpedo AS mst_stat_torpedo,
    m.stat_speed AS mst_stat_speed,
    m.stat_bomb AS mst_stat_bomb,
    m.stat_aa AS mst_stat_aa,
    m.stat_asw AS mst_stat_asw,
    m.stat_hit AS mst_stat_hit,
    m.stat_evasion AS mst_stat_evasion,
    m.stat_los AS mst_stat_los,
    m.stat_luck AS mst_stat_luck,
    m.broken_fuel AS mst_broken_fuel,
    m.broken_ammo AS mst_broken_ammo,
    m.broken_steel AS mst_broken_steel,
    m.broken_bauxite AS mst_broken_bauxite,
    m.cost AS mst_cost,
    m.distance AS mst_distance,
    m.useBull AS mst_useBull,
    m.gfxVersion AS mst_gfxVersion,
    m.updatedAt AS mst_updatedAt
  FROM slotitems s
  LEFT JOIN slotitem_mst m ON m.id = s.masterId
`;

export async function getWithMaster(uid: number): Promise<SlotItemJoinedRow | null> {
  const rs = await query(`${JOIN_SQL} WHERE s.uid = ? LIMIT 1`, [uid]);
  return readOne(rs, mapJoinedRow);
}

export async function listWithMaster(): Promise<SlotItemJoinedRow[]> {
  const rs = await query(`${JOIN_SQL} ORDER BY s.uid ASC`, []);
  return readRows(rs, mapJoinedRow);
}

export async function listWithMasterByUids(uids: readonly number[]): Promise<SlotItemJoinedRow[]> {
  if (!uids.length) return [];
  const marks = uids.map(() => '?').join(',');
  const rs = await query(`${JOIN_SQL} WHERE s.uid IN (${marks})`, [...uids]);
  return readRows(rs, mapJoinedRow);
}
