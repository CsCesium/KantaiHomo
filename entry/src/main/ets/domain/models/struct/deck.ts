import type { ExpeditionSlotState } from './expedition';

export interface Deck {
  deckId: number;
  name: string;
  shipUids: number[];
  expedition: ExpeditionSlotState;
  updatedAt: number;
}