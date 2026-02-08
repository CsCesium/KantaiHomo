import { AnyPortEvt } from '../../../domain/events';
import {
  PortSnapshot,
  Admiral,
  admiralToRow,
  Materials,
  materialsToRow,
  Deck,
  deckToRow,
  Ndock,
  ndockToRow,
  Kdock,
  kdockToRow,
  Ship,
  shipToRow,
  SlotItem,
  slotItemToRow
} from '../../../domain/models';
import { updateFromPort, updateAdmiral, updateMaterials, updateDecks, updateNdocks } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class PortPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyPortEvt;
    const ts = ev.timestamp ?? Date.now();

    switch (e.type) {
      case 'PORT_SNAPSHOT':
        await this.handleSnapshot(e.payload, ts, deps);
        break;
      case 'PORT_BASIC':
        await this.handleBasic(e.payload, ts, deps);
        break;
      case 'PORT_RESOURCES':
        await this.handleResources(e.payload, ts, deps);
        break;
      case 'PORT_FLEETS':
        await this.handleFleets(e.payload, ts, deps);
        break;
      case 'PORT_NDOCK':
        await this.handleNdock(e.payload, ts, deps);
        break;
      case 'PORT_KDOCK':
        await this.handleKdock(e.payload, ts, deps);
        break;
      case 'PORT_SHIPS':
        await this.handleShips(e.payload, ts, deps);
        break;
      case 'PORT_SLOTITEMS':
        await this.handleSlotItems(e.payload, ts, deps);
        break;
    }
  }
  private async handleSnapshot(payload: PortSnapshot, ts: number, deps: PersistDeps): Promise<void> {
    const snapshot = payload;
    updateFromPort({
      admiral: snapshot.admiral,
      materials: snapshot.materials,
      decks: snapshot.decks,
      ships: snapshot.ships,
    });
    console.info('[port] snapshot updated to GameState');
    return;
  }

  private async handleBasic(payload: Admiral, ts: number, deps: PersistDeps): Promise<void> {
    updateAdmiral(payload);

    if (!deps.repos?.admiral) {
      console.warn('[persist][PORT_BASIC] repository not provided');
      return;
    }
    const row = admiralToRow(payload);
    await deps.repos.admiral.upsert(row);
  }

  private async handleResources(payload: Materials, ts: number, deps: PersistDeps): Promise<void> {
    updateMaterials(payload);
    if (!deps.repos?.material) {
      console.warn('[persist][PORT_RESOURCES] repository not provided');
      return;
    }
    const row = materialsToRow(payload);
    await deps.repos.material.appendIfChanged(row);
  }

  private async handleFleets(payload: Deck[], ts: number, deps: PersistDeps): Promise<void> {
    updateDecks(payload);

    if (!deps.repos?.deck) {
      console.warn('[persist][PORT_FLEETS] repository not provided');
      return;
    }
    const rows = payload.map(deckToRow);
    await deps.repos.deck.upsertBatch(rows);
  }

  private async handleNdock(payload: Ndock[], ts: number, deps: PersistDeps): Promise<void> {
    updateNdocks(payload);

    if (!deps.repos?.repair) {
      console.warn('[persist][PORT_NDOCK] repository not provided');
      return;
    }
    const rows = payload.map(ndockToRow);
    await deps.repos.repair.upsertBatch(rows);
  }

  private async handleKdock(payload: Kdock[], ts: number, deps: PersistDeps): Promise<void> {
    if (!deps.repos?.build) {
      console.warn('[persist][PORT_KDOCK] repository not provided');
      return;
    }
    const rows = payload.map(kdockToRow);
    await deps.repos.build.upsertBatch(rows);
  }

  private async handleShips(payload: Ship[], ts: number, deps: PersistDeps): Promise<void> {
    if (!deps.repos?.ship) {
      console.warn('[persist][PORT_SHIPS] repository not provided');
      return;
    }
    const rows = payload.map(shipToRow);
    await deps.repos.ship.upsertBatch(rows);
  }

  private async handleSlotItems(payload: SlotItem[], ts: number, deps: PersistDeps): Promise<void> {
    if (!deps.repos?.slotitem) {
      console.warn('[persist][PORT_SLOTITEMS] repository not provided');
      return;
    }
    const rows = payload.map(slotItemToRow);
    await deps.repos.slotitem.upsertBatch(rows);
  }
}

const handler = new PortPersistHandler();
registerHandler('PORT_SNAPSHOT', handler);
registerHandler('PORT_BASIC', handler);
registerHandler('PORT_RESOURCES', handler);
registerHandler('PORT_FLEETS', handler);
registerHandler('PORT_NDOCK', handler);
registerHandler('PORT_KDOCK', handler);
registerHandler('PORT_SHIPS', handler);
registerHandler('PORT_SLOTITEMS', handler);
