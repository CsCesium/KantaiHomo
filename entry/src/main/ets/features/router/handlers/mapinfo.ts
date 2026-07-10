import type { MapInfoUpdateEvent, MapGaugeRaw } from '../../../domain/events/mapinfo';
import type { MapGaugeSnapshot } from '../../state/type';
import { updateMapGauges, getMapGauges, getDecks, getDeckShips } from '../../state';
import { publishAlert } from '../../alerts/bus';
import { registerHandler } from '../persist/registry';
import type { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class MapInfoHandler implements Handler {
  async handle(ev: HandlerEvent, _deps: PersistDeps): Promise<void> {
    const e = ev as MapInfoUpdateEvent;
    const gauges = e.payload as MapGaugeRaw[];
    const now = Date.now();

    const snapshots: MapGaugeSnapshot[] = gauges.map(g => ({ ...g, capturedAt: now }));
    if (e.endpoint === '/api_req_map/select_eventmap_rank') {
      // 难度选择响应只包含一个海域，不能覆盖掉其它海域的血条。
      const merged = [...getMapGauges()];
      for (const patch of snapshots) {
        const previous = merged.find((g: MapGaugeSnapshot) => g.mapId === patch.mapId);
        const next: MapGaugeSnapshot = {
          ...patch,
          gaugeType: patch.gaugeType ?? previous?.gaugeType ?? null,
          gaugeNum: patch.gaugeNum > 0 ? patch.gaugeNum : (previous?.gaugeNum ?? 1),
        };
        for (let i = merged.length - 1; i >= 0; i--) {
          if (merged[i].mapId === patch.mapId) merged.splice(i, 1);
        }
        merged.push(next);
      }
      updateMapGauges(merged);
    } else {
      updateMapGauges(snapshots);
    }

    this.checkFleetStatus();
  }

  private checkFleetStatus(): void {
    const decks = getDecks();
    const unsuppliedDecks: number[] = [];
    const idleDecks: number[] = [];
    const fleet1LowCondShipUids: number[] = [];

    for (const deck of decks) {
      const onExpedition = deck.expeditionReturnTime !== null &&
        deck.expeditionReturnTime > Date.now();

      if (!onExpedition) {
        const ships = getDeckShips(deck.deckId);

        // Check supply status of ships in this deck
        const anyUnsupplied = ships.some(s => s.needsResupply);
        if (anyUnsupplied) {
          unsuppliedDecks.push(deck.deckId);
        }

        // Fleet 1: also flag any ship with cond < 30
        if (deck.deckId === 1) {
          for (const s of ships) {
            if (s.cond < 30) fleet1LowCondShipUids.push(s.uid);
          }
        }

        // Decks 2-4 should ideally be on expedition
        if (deck.deckId >= 2) {
          idleDecks.push(deck.deckId);
        }
      }
    }

    if (
      unsuppliedDecks.length > 0 ||
      idleDecks.length > 0 ||
      fleet1LowCondShipUids.length > 0
    ) {
      publishAlert({
        type: 'fleet_status',
        timestamp: Date.now(),
        unsuppliedDecks,
        idleDecks,
        fleet1LowCondShipUids,
      });
    }
  }
}

const handler = new MapInfoHandler();
registerHandler('MAP_INFO_UPDATE', handler);
