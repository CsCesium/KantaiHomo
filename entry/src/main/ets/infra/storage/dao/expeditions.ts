//src/main/ets/infra/store/dao/ExpeditionsDao.ts
import { query, withTransaction, readRows, readOne, int } from '../db';
import type relationalStore from '@ohos.data.relationalStore';

export interface ExpeditionRow {
  deckId: number;
  missionId: number;
  progress: number;
  returnTime: number;
  updatedAt: number;
}

const mapExpedition = (rs: relationalStore.ResultSet): ExpeditionRow => ({
  deckId: int(rs, 'deckId') ?? 0,
  missionId: int(rs, 'missionId') ?? 0,
  progress: int(rs, 'progress') ?? 0,
  returnTime: int(rs, 'returnTime') ?? 0,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: ExpeditionRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO expeditions
         (deckId, missionId, progress, returnTime, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [r.deckId, r.missionId, r.progress, r.returnTime, r.updatedAt]
      );
    }
  });
}

export async function listExpeditions(): Promise<ExpeditionRow[]> {
  const rs = await query(
    `SELECT deckId, missionId, progress, returnTime, updatedAt FROM expeditions ORDER BY deckId ASC`, []
  );
  return readRows(rs, mapExpedition);
}

export async function getNextExpeditionAfter(nowMs: number):
  Promise<Pick<ExpeditionRow, 'deckId' | 'missionId' | 'returnTime'> | null> {
  const rs = await query(
    `SELECT deckId, missionId, returnTime FROM expeditions WHERE returnTime > ? ORDER BY returnTime ASC LIMIT 1`,
    [nowMs]
  );
  return readOne(rs, (row) => ({
    deckId: int(row, 'deckId') ?? 0,
    missionId: int(row, 'missionId') ?? 0,
    returnTime: int(row, 'returnTime') ?? 0,
  }));
}