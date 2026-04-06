import { query, withTransaction, readRows, int, str } from '../db';
import type relationalStore from '@ohos.data.relationalStore';
import { ExpeditionResultRow } from '../types';

const mapRow = (rs: relationalStore.ResultSet): ExpeditionResultRow => ({
  id: int(rs, 'id') ?? undefined,
  deckId: int(rs, 'deckId') ?? 0,
  missionId: int(rs, 'missionId') ?? 0,
  clear: int(rs, 'clear') ?? 0,
  admiral_lv: int(rs, 'admiral_lv'),
  admiral_getExp: int(rs, 'admiral_getExp'),
  materials: str(rs, 'materials'),
  items: str(rs, 'items'),
  finishedAt: int(rs, 'finishedAt') ?? 0,
});

export async function insert(row: ExpeditionResultRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT INTO expedition_results
         (deckId, missionId, clear, admiral_lv, admiral_getExp, materials, items, finishedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.deckId,
        row.missionId,
        row.clear,
        row.admiral_lv ?? null,
        row.admiral_getExp ?? null,
        row.materials ?? null,
        row.items ?? null,
        row.finishedAt,
      ]
    );
  });
}

export async function listByMission(missionId: number, limit = 100): Promise<ExpeditionResultRow[]> {
  const rs = await query(
    `SELECT * FROM expedition_results WHERE missionId = ? ORDER BY finishedAt DESC LIMIT ?`,
    [missionId, limit]
  );
  return readRows(rs, mapRow);
}

export async function listRecent(limit: number): Promise<ExpeditionResultRow[]> {
  const rs = await query(
    `SELECT * FROM expedition_results ORDER BY finishedAt DESC LIMIT ?`,
    [limit]
  );
  return readRows(rs, mapRow);
}
