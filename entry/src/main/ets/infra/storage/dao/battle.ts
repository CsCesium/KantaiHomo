import { str, int, withTransaction, query, readOne, readRows } from "../db";
import { relationalStore } from "@kit.ArkData";
import { BattleRecordRow } from "../types";

const mapRow = (rs: relationalStore.ResultSet): BattleRecordRow => ({
  id: str(rs, 'id') ?? '',
  sortieId: str(rs, 'sortieId') ?? '',

  mapAreaId: int(rs, 'mapAreaId') ?? 0,
  mapInfoNo: int(rs, 'mapInfoNo') ?? 0,
  cellId: int(rs, 'cellId') ?? 0,
  cellEventId: int(rs, 'cellEventId') ?? 0,
  isBoss: int(rs, 'isBoss') ?? 0,

  battleType: str(rs, 'battleType') ?? 'normal',
  isPractice: int(rs, 'isPractice') ?? 0,

  friendFormation: int(rs, 'friendFormation'),
  enemyFormation: int(rs, 'enemyFormation'),
  engagement: int(rs, 'engagement'),
  airState: int(rs, 'airState'),

  friendFleetJson: str(rs, 'friendFleetJson') ?? '{}',
  friendFleetEscortJson: str(rs, 'friendFleetEscortJson'),
  enemyFleetJson: str(rs, 'enemyFleetJson') ?? '{}',
  enemyFleetEscortJson: str(rs, 'enemyFleetEscortJson'),
  airBasesJson: str(rs, 'airBasesJson'),
  hpStartJson: str(rs, 'hpStartJson') ?? '{}',
  hpEndJson: str(rs, 'hpEndJson') ?? '{}',

  rank: str(rs, 'rank') ?? '',
  mvp: int(rs, 'mvp'),
  mvpCombined: int(rs, 'mvpCombined'),
  dropShipId: int(rs, 'dropShipId'),
  dropShipName: str(rs, 'dropShipName'),
  dropItemId: int(rs, 'dropItemId'),
  baseExp: int(rs, 'baseExp'),

  startedAt: int(rs, 'startedAt') ?? 0,
  endedAt: int(rs, 'endedAt') ?? 0,
  createdAt: int(rs, 'createdAt') ?? 0,
});

export async function insert(row: BattleRecordRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT INTO battle_records (
        id, sortieId,
        mapAreaId, mapInfoNo, cellId, cellEventId, isBoss,
        battleType, isPractice,
        friendFormation, enemyFormation, engagement, airState,
        friendFleetJson, friendFleetEscortJson,
        enemyFleetJson, enemyFleetEscortJson,
        airBasesJson, hpStartJson, hpEndJson,
        rank, mvp, mvpCombined,
        dropShipId, dropShipName, dropItemId, baseExp,
        startedAt, endedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.sortieId,
        row.mapAreaId, row.mapInfoNo, row.cellId, row.cellEventId, row.isBoss,
        row.battleType, row.isPractice,
        row.friendFormation, row.enemyFormation, row.engagement, row.airState,
        row.friendFleetJson, row.friendFleetEscortJson,
        row.enemyFleetJson, row.enemyFleetEscortJson,
        row.airBasesJson, row.hpStartJson, row.hpEndJson,
        row.rank, row.mvp, row.mvpCombined,
        row.dropShipId, row.dropShipName, row.dropItemId, row.baseExp,
        row.startedAt, row.endedAt, row.createdAt || Date.now(),
      ]
    );
  });
}

export async function get(id: string): Promise<BattleRecordRow | null> {
  const rs = await query(`SELECT * FROM battle_records WHERE id = ? LIMIT 1`, [id]);
  return readOne(rs, mapRow);
}

export async function listBySortie(sortieId: string): Promise<BattleRecordRow[]> {
  const rs = await query(
    `SELECT * FROM battle_records WHERE sortieId = ? ORDER BY startedAt ASC`,
    [sortieId]
  );
  return readRows(rs, mapRow);
}

export async function listByMap(mapAreaId: number, mapInfoNo: number, limit = 100): Promise<BattleRecordRow[]> {
  const rs = await query(
    `SELECT * FROM battle_records
     WHERE mapAreaId = ? AND mapInfoNo = ?
     ORDER BY startedAt DESC
     LIMIT ?`,
    [mapAreaId, mapInfoNo, limit]
  );
  return readRows(rs, mapRow);
}

export async function listRecent(limit: number): Promise<BattleRecordRow[]> {
  const rs = await query(
    `SELECT * FROM battle_records ORDER BY startedAt DESC LIMIT ?`,
    [limit]
  );
  return readRows(rs, mapRow);
}

export async function remove(id: string): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(`DELETE FROM battle_records WHERE id = ?`, [id]);
  });
}

export async function deleteOlderThan(timestampMs: number): Promise<number> {
  let count = 0;
  await withTransaction(async (db) => {
    // 获取数量
    const rs = await query(
      `SELECT COUNT(*) as cnt FROM battle_records WHERE startedAt < ?`,
      [timestampMs]
    );
    const row = readOne(rs, (r) => int(r, 'cnt') ?? 0);
    count = row ?? 0;

    // 删除
    await db.executeSql(`DELETE FROM battle_records WHERE startedAt < ?`, [timestampMs]);
  });
  return count;
}
