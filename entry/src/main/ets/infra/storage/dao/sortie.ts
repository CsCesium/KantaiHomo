import { str, int, withTransaction, query, readOne, readRows } from "../db";
import { SortieRecordRow } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): SortieRecordRow => ({
  id: str(rs, 'id') ?? '',

  mapAreaId: int(rs, 'mapAreaId') ?? 0,
  mapInfoNo: int(rs, 'mapInfoNo') ?? 0,
  deckId: int(rs, 'deckId') ?? 0,
  combinedType: int(rs, 'combinedType') ?? 0,

  fleetSnapshotJson: str(rs, 'fleetSnapshotJson') ?? '{}',
  fleetSnapshotEscortJson: str(rs, 'fleetSnapshotEscortJson'),

  routeJson: str(rs, 'routeJson') ?? '[]',

  result: str(rs, 'result') ?? 'ongoing',
  bossReached: int(rs, 'bossReached') ?? 0,
  bossKilled: int(rs, 'bossKilled') ?? 0,

  fuelUsed: int(rs, 'fuelUsed') ?? 0,
  ammoUsed: int(rs, 'ammoUsed') ?? 0,

  startedAt: int(rs, 'startedAt') ?? 0,
  endedAt: int(rs, 'endedAt'),
  createdAt: int(rs, 'createdAt') ?? 0,
});

export async function insert(row: SortieRecordRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT INTO sortie_records (
        id,
        mapAreaId, mapInfoNo, deckId, combinedType,
        fleetSnapshotJson, fleetSnapshotEscortJson,
        routeJson,
        result, bossReached, bossKilled,
        fuelUsed, ammoUsed,
        startedAt, endedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.mapAreaId, row.mapInfoNo, row.deckId, row.combinedType,
        row.fleetSnapshotJson, row.fleetSnapshotEscortJson,
        row.routeJson,
        row.result, row.bossReached, row.bossKilled,
        row.fuelUsed, row.ammoUsed,
        row.startedAt, row.endedAt, row.createdAt || Date.now(),
      ]
    );
  });
}

export async function update(row: SortieRecordRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `UPDATE sortie_records SET
        routeJson = ?,
        result = ?,
        bossReached = ?,
        bossKilled = ?,
        fuelUsed = ?,
        ammoUsed = ?,
        endedAt = ?
      WHERE id = ?`,
      [
        row.routeJson,
        row.result,
        row.bossReached,
        row.bossKilled,
        row.fuelUsed,
        row.ammoUsed,
        row.endedAt,
        row.id,
      ]
    );
  });
}

export async function get(id: string): Promise<SortieRecordRow | null> {
  const rs = await query(`SELECT * FROM sortie_records WHERE id = ? LIMIT 1`, [id]);
  return readOne(rs, mapRow);
}

export async function listByMap(mapAreaId: number, mapInfoNo: number, limit = 100): Promise<SortieRecordRow[]> {
  const rs = await query(
    `SELECT * FROM sortie_records
     WHERE mapAreaId = ? AND mapInfoNo = ?
     ORDER BY startedAt DESC
     LIMIT ?`,
    [mapAreaId, mapInfoNo, limit]
  );
  return readRows(rs, mapRow);
}

export async function listRecent(limit: number): Promise<SortieRecordRow[]> {
  const rs = await query(
    `SELECT * FROM sortie_records ORDER BY startedAt DESC LIMIT ?`,
    [limit]
  );
  return readRows(rs, mapRow);
}

export async function remove(id: string): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(`DELETE FROM sortie_records WHERE id = ?`, [id]);
  });
}
