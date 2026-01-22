import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { relationalStore } from "@kit.ArkData";
import type {
  SlotItemRow as RepoSlotItemRow,
  SlotItemMasterRow as RepoSlotItemMasterRow,
} from '../../storage/repo/types';

export type SlotItemMasterRow =
  Omit<RepoSlotItemMasterRow, 'cost' | 'distance' | 'useBull' | 'gfxVersion' | 'extras'> & {
    cost: number | null;
    distance: number | null;
    useBull: number | null;
    gfxVersion: number | null;
  };

export type SlotItemInstRow =
  Omit<RepoSlotItemRow, 'locked' | 'level' | 'alv' | 'extras'> & {
    locked: 0 | 1;
    level: number | null;
    alv: number | null;
  };

export interface SlotItemJoinedRow {
  uid: number;
  masterId: number;
  locked: number;
  level: number | null;
  alv: number | null;
  itemUpdatedAt: number;

  mst_id: number | null;
  mst_sortNo: number | null;
  mst_name: string | null;

  mst_typeMajor: number | null;
  mst_typeBook: number | null;
  mst_typeEquipType: number | null;
  mst_typeIconId: number | null;
  mst_typeAircraft: number | null;

  mst_rarity: number | null;
  mst_range: number | null;

  mst_stat_hp: number | null;
  mst_stat_armor: number | null;
  mst_stat_firepower: number | null;
  mst_stat_torpedo: number | null;
  mst_stat_speed: number | null;
  mst_stat_bomb: number | null;
  mst_stat_aa: number | null;
  mst_stat_asw: number | null;
  mst_stat_hit: number | null;
  mst_stat_evasion: number | null;
  mst_stat_los: number | null;
  mst_stat_luck: number | null;

  mst_broken_fuel: number | null;
  mst_broken_ammo: number | null;
  mst_broken_steel: number | null;
  mst_broken_bauxite: number | null;

  mst_cost: number | null;
  mst_distance: number | null;
  mst_useBull: number | null;
  mst_gfxVersion: number | null;

  mst_updatedAt: number | null;
}

const mapJoined = (rs: relationalStore.ResultSet): SlotItemJoinedRow => ({
  uid: int(rs, 'uid') ?? 0,
  masterId: int(rs, 'masterId') ?? 0,
  locked: int(rs, 'locked') ?? 0,
  level: int(rs, 'level') ?? null,
  alv: int(rs, 'alv') ?? null,
  itemUpdatedAt: int(rs, 'itemUpdatedAt') ?? 0,

  mst_id: int(rs, 'mst_id') ?? null,
  mst_sortNo: int(rs, 'mst_sortNo') ?? null,
  mst_name: str(rs, 'mst_name') ?? null,

  mst_typeMajor: int(rs, 'mst_typeMajor') ?? null,
  mst_typeBook: int(rs, 'mst_typeBook') ?? null,
  mst_typeEquipType: int(rs, 'mst_typeEquipType') ?? null,
  mst_typeIconId: int(rs, 'mst_typeIconId') ?? null,
  mst_typeAircraft: int(rs, 'mst_typeAircraft') ?? null,

  mst_rarity: int(rs, 'mst_rarity') ?? null,
  mst_range: int(rs, 'mst_range') ?? null,

  mst_stat_hp: int(rs, 'mst_stat_hp') ?? null,
  mst_stat_armor: int(rs, 'mst_stat_armor') ?? null,
  mst_stat_firepower: int(rs, 'mst_stat_firepower') ?? null,
  mst_stat_torpedo: int(rs, 'mst_stat_torpedo') ?? null,
  mst_stat_speed: int(rs, 'mst_stat_speed') ?? null,
  mst_stat_bomb: int(rs, 'mst_stat_bomb') ?? null,
  mst_stat_aa: int(rs, 'mst_stat_aa') ?? null,
  mst_stat_asw: int(rs, 'mst_stat_asw') ?? null,
  mst_stat_hit: int(rs, 'mst_stat_hit') ?? null,
  mst_stat_evasion: int(rs, 'mst_stat_evasion') ?? null,
  mst_stat_los: int(rs, 'mst_stat_los') ?? null,
  mst_stat_luck: int(rs, 'mst_stat_luck') ?? null,

  mst_broken_fuel: int(rs, 'mst_broken_fuel') ?? null,
  mst_broken_ammo: int(rs, 'mst_broken_ammo') ?? null,
  mst_broken_steel: int(rs, 'mst_broken_steel') ?? null,
  mst_broken_bauxite: int(rs, 'mst_broken_bauxite') ?? null,

  mst_cost: int(rs, 'mst_cost') ?? null,
  mst_distance: int(rs, 'mst_distance') ?? null,
  mst_useBull: int(rs, 'mst_useBull') ?? null,
  mst_gfxVersion: int(rs, 'mst_gfxVersion') ?? null,

  mst_updatedAt: int(rs, 'mst_updatedAt') ?? null,
});

export async function upsertMasterBatch(rows: SlotItemMasterRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO slotitem_mst (
           id, sortNo, name,
           typeMajor, typeBook, typeEquipType, typeIconId, typeAircraft,
           rarity, range,
           stat_hp, stat_armor, stat_firepower, stat_torpedo, stat_speed, stat_bomb, stat_aa, stat_asw, stat_hit, stat_evasion, stat_los, stat_luck,
           broken_fuel, broken_ammo, broken_steel, broken_bauxite,
           cost, distance, useBull, gfxVersion,
           updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.sortNo, r.name,
          (r as any).typeMajor, (r as any).typeBook, (r as any).typeEquipType, (r as any).typeIconId, (r as any).typeAircraft,
          (r as any).rarity, (r as any).range,
          (r as any).stat_hp, (r as any).stat_armor, (r as any).stat_firepower, (r as any).stat_torpedo, (r as any).stat_speed, (r as any).stat_bomb, (r as any).stat_aa, (r as any).stat_asw, (r as any).stat_hit, (r as any).stat_evasion, (r as any).stat_los, (r as any).stat_luck,
          (r as any).broken_fuel, (r as any).broken_ammo, (r as any).broken_steel, (r as any).broken_bauxite,
          r.cost, r.distance, r.useBull, r.gfxVersion,
          (r as any).updatedAt,
        ]
      );
    }
  });
}

export async function upsertBatch(rows: SlotItemInstRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO slotitems
         (uid, masterId, locked, level, alv, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.uid, r.masterId, r.locked, r.level, r.alv, (r as any).updatedAt]
      );
    }
  });
}

const BASE_JOIN_SQL = `
  SELECT
    s.uid AS uid,
    s.masterId AS masterId,
    s.locked AS locked,
    s.level AS level,
    s.alv AS alv,
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

export async function listWithMaster(): Promise<SlotItemJoinedRow[]> {
  const rs = await query(`${BASE_JOIN_SQL} ORDER BY s.uid ASC`, []);
  return readRows(rs, mapJoined);
}

export async function getWithMaster(uid: number): Promise<SlotItemJoinedRow | null> {
  const rs = await query(`${BASE_JOIN_SQL} WHERE s.uid = ? LIMIT 1`, [uid]);
  return readOne(rs, mapJoined);
}

export async function listWithMasterByUids(uids: ReadonlyArray<number>): Promise<SlotItemJoinedRow[]> {
  if (!uids.length) return [];
  const marks = uids.map(() => '?').join(',');
  const rs = await query(`${BASE_JOIN_SQL} WHERE s.uid IN (${marks})`, [...uids]);
  return readRows(rs, mapJoined);
}