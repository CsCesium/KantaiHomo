import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { DeckRow } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): DeckRow => ({
  deckId: int(rs, 'deckId') ?? 0,
  name: str(rs, 'name') ?? '',
  shipUidsJson: str(rs, 'shipUidsJson') ?? '[]',
  expeditionProgress: int(rs, 'expeditionProgress') ?? 0,
  expeditionMissionId: int(rs, 'expeditionMissionId') ?? 0,
  expeditionReturnTime: int(rs, 'expeditionReturnTime') ?? 0,
  expeditionUpdatedAt: int(rs, 'expeditionUpdatedAt') ?? 0,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: readonly DeckRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO decks
         (deckId, name, shipUidsJson, expeditionProgress, expeditionMissionId, expeditionReturnTime, expeditionUpdatedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.deckId, r.name, r.shipUidsJson,
          r.expeditionProgress, r.expeditionMissionId, r.expeditionReturnTime, r.expeditionUpdatedAt,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function list(): Promise<DeckRow[]> {
  const rs = await query(`SELECT * FROM decks ORDER BY deckId ASC`, []);
  return readRows(rs, mapRow);
}

export async function get(deckId: number): Promise<DeckRow | null> {
  const rs = await query(`SELECT * FROM decks WHERE deckId = ? LIMIT 1`, [deckId]);
  return readOne(rs, mapRow);
}
