import type { DeckSnapshot } from './type';

export const STRIKING_FORCE_DECK_ID: number = 3;
export const STRIKING_FORCE_FLEET_INDEX: number = STRIKING_FORCE_DECK_ID - 1;

const STRIKING_FORCE_FULL_SHIP_COUNT: number = 7;

/** The third fleet is a striking force only while all seven ship slots are filled. */
export function isFullStrikingForce(decks: ReadonlyArray<DeckSnapshot>): boolean {
  const deck = decks.find((item: DeckSnapshot): boolean => item.deckId === STRIKING_FORCE_DECK_ID);
  return deck !== undefined && deck.shipUids.length === STRIKING_FORCE_FULL_SHIP_COUNT;
}
