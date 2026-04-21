import type { MapInfoUpdateEvent, MapGaugeRaw } from '../../../domain/events/mapinfo';
import type { MapGaugeSnapshot } from '../../state/type';
import { updateMapGauges, getDecks, getDeckShips } from '../../state';
import { publishAlert } from '../../alerts/bus';
import { registerHandler } from '../persist/registry';
import type { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class MapInfoHandler implements Handler {
  async handle(ev: HandlerEvent, _deps: PersistDeps): Promise<void> {
    const e = ev as MapInfoUpdateEvent;
    const gauges = e.payload as MapGaugeRaw[];
    const now = Date.now();

    const snapshots: MapGaugeSnapshot[] = gauges.map(g => ({ ...g, capturedAt: now }));
    updateMapGauges(snapshots);

    this.checkFleetStatus();
  }

  private checkFleetStatus(): void {
    const decks = getDecks();
    const unsuppliedDecks: number[] = [];
    const idleDecks: number[] = [];

    for (const deck of decks) {
      const onExpedition = deck.expeditionReturnTime !== null &&
        deck.expeditionReturnTime > Date.now();

      if (!onExpedition) {
        // Check supply status of ships in this deck
        const ships = getDeckShips(deck.deckId);
        const anyUnsupplied = ships.some(s => s.needsResupply);
        if (anyUnsupplied) {
          unsuppliedDecks.push(deck.deckId);
        }

        // Decks 2-4 should ideally be on expedition
        if (deck.deckId >= 2) {
          idleDecks.push(deck.deckId);
        }
      }
    }

    if (unsuppliedDecks.length > 0 || idleDecks.length > 0) {
      publishAlert({
        type: 'fleet_status',
        timestamp: Date.now(),
        unsuppliedDecks,
        idleDecks,
      });
    }
  }
}

const handler = new MapInfoHandler();
registerHandler('MAP_INFO_UPDATE', handler);
