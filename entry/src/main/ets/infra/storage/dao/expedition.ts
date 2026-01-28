//src/main/ets/infra/store/dao/ExpeditionsDao.ts
import { query, withTransaction, readRows, readOne, int } from '../db';
import type relationalStore from '@ohos.data.relationalStore';
import { ExpeditionRow } from '../types';

const mapRow = (rs: relationalStore.ResultSet): ExpeditionRow => ({
  deckId: int(rs, 'deckId') ?? 0,
  missionId: int(rs, 'missionId') ?? 0,
  progress: int(rs, 'progress') ?? 0,
  returnTime: int(rs, 'returnTime') ?? 0,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: readonly ExpeditionRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO expeditions (deckId, missionId, progress, returnTime, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [r.deckId, r.missionId, r.progress, r.returnTime, r.updatedAt]
      );
    }
  });
}

export async function list(): Promise<ExpeditionRow[]> {
  const rs = await query(`SELECT * FROM expeditions ORDER BY deckId ASC`, []);
  return readRows(rs, mapRow);
}

export async function getNextAfter(nowMs: number): Promise<{ deckId: number; missionId: number; returnTime: number } | null> {
  const rs = await query(
    `SELECT deckId, missionId, returnTime FROM expeditions WHERE returnTime > ? ORDER BY returnTime ASC LIMIT 1`,
    [nowMs]
  );
  return readOne(rs, (r) => ({
    deckId: int(r, 'deckId') ?? 0,
    missionId: int(r, 'missionId') ?? 0,
    returnTime: int(r, 'returnTime') ?? 0,
  }));
}
