import { ApiDeckPortRaw, normalizeDeckMission } from "..";
import { Deck } from "../struct/deck";

export function normalizeDeck(raw: ApiDeckPortRaw, now: number = Date.now()): Deck {
  return {
    deckId: raw.api_id,
    name: raw.api_name ?? '',
    shipUids: (raw.api_ship ?? []).filter((x) => (x ?? 0) > 0),
    expedition: normalizeDeckMission(raw.api_id, raw.api_mission, now),
    updatedAt: now,
  };
}

export function normalizeDecks(raw: ApiDeckPortRaw[], now: number = Date.now()): Deck[] {
  return (raw ?? []).map((d) => normalizeDeck(d, now));
}