import type { DeckRow as RepoDeckRow } from '../../storage/repo/types';
import { int, str, withTransaction, query, readRows, readOne } from '../db';
import { relationalStore } from '@kit.ArkData';

export type DeckDbRow = Omit<RepoDeckRow, 'shipUids'> & { shipUidsJson: string };

const mapDeck = (rs: relationalStore.ResultSet): DeckDbRow => ({
  deckId: int(rs, 'deckId') ?? 0,
  name: str(rs, 'name') ?? '',
  shipUidsJson: str(rs, 'shipUidsJson') ?? '[]',

  expeditionProgress: int(rs, 'expeditionProgress') ?? 0,
  expeditionMissionId: int(rs, 'expeditionMissionId') ?? 0,
  expeditionReturnTime: int(rs, 'expeditionReturnTime') ?? 0,
  expeditionUpdatedAt: int(rs, 'expeditionUpdatedAt') ?? 0,

  updatedAt: int(rs, 'updatedAt') ?? 0,
});
export async function upsertBatch(rows: DeckDbRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO decks
         (deckId, name, shipUidsJson,
          expeditionProgress, expeditionMissionId, expeditionReturnTime, expeditionUpdatedAt,
          updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.deckId,
          r.name,
          r.shipUidsJson,
          r.expeditionProgress,
          r.expeditionMissionId,
          r.expeditionReturnTime,
          r.expeditionUpdatedAt,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function listDecks(): Promise<DeckDbRow[]> {
  const rs = await query(
    `SELECT
       deckId, name, shipUidsJson,
       expeditionProgress, expeditionMissionId, expeditionReturnTime, expeditionUpdatedAt,
       updatedAt
     FROM decks
     ORDER BY deckId ASC`,
    []
  );
  return readRows(rs, mapDeck);
}

export async function getDeck(deckId: number): Promise<DeckDbRow | null> {
  const rs = await query(
    `SELECT
       deckId, name, shipUidsJson,
       expeditionProgress, expeditionMissionId, expeditionReturnTime, expeditionUpdatedAt,
       updatedAt
     FROM decks
     WHERE deckId = ?
     LIMIT 1`,
    [deckId]
  );
  return readOne(rs, mapDeck);
}