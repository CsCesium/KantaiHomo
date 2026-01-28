/**
 * Deck Mapper - 统一数据层转换
 */

import { Deck } from '../struct/deck';
import { ExpeditionProgress } from '../struct/expedition';
import type { DeckRow, DeckRowWrite } from '../../../infra/storage/repo/types';

/**
 * 将 Deck struct 转换为 DeckRowWrite
 */
export function deckToRow(deck: Deck): DeckRowWrite {
  return {
    deckId: deck.deckId,
    name: deck.name,
    shipUids: deck.shipUids,

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
    shipUids: Array.isArray(row.shipUids) ? row.shipUids : [],

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
export function decksToRows(decks: readonly Deck[]): DeckRowWrite[] {
  return decks.map(deckToRow);
}

export function rowsToDecks(rows: readonly DeckRow[]): Deck[] {
  return rows.map(rowToDeck);
}
