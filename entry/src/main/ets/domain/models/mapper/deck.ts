/**
 * Deck Mapper - 统一数据层转换
 */

import { safeParseJsonArray } from '..';
import { DeckRow } from '../../../infra/storage/types';
import { Deck } from '../struct/deck';
import { ExpeditionProgress } from '../struct/expedition';

/**
 * 将 Deck struct 转换为 DeckRowWrite
 */
export function deckToRow(deck: Deck): DeckRow {
  return {
    deckId: deck.deckId,
    name: deck.name,
    shipUidsJson:JSON.stringify(deck.shipUids),

    expeditionProgress: deck.expedition.progress,
    expeditionMissionId: deck.expedition.missionId,
    expeditionReturnTime: deck.expedition.returnTime,
    expeditionUpdatedAt: deck.expedition.updatedAt,

    updatedAt: deck.updatedAt,
  };
}

/**
 * 将 DeckRow 转换为 Deck struct
 */
export function rowToDeck(row: DeckRow): Deck {
  return {
    deckId: row.deckId,
    name: row.name,
    shipUids: safeParseJsonArray(row.shipUidsJson),

    expedition: {
      deckId: row.deckId,
      progress: (row.expeditionProgress ?? 0) as ExpeditionProgress,
      missionId: row.expeditionMissionId ?? 0,
      returnTime: row.expeditionReturnTime ?? 0,
      updatedAt: row.expeditionUpdatedAt ?? row.updatedAt,
    },

    updatedAt: row.updatedAt,
  };
}

/**
 * 批量转换 Decks
 */
export function decksToRows(decks: readonly Deck[]): DeckRow[] {
  return decks.map(deckToRow);
}

export function rowsToDecks(rows: readonly DeckRow[]): Deck[] {
  return rows.map(rowToDeck);
}
