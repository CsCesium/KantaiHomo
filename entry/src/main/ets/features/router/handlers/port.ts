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
  shipToRow
} from '../../../domain/models';
import { updateFromPort, updateAdmiral, updateMaterials, updateDecks, updateNdocks, updateKdocks,
  updateShips, clearBattleState, clearEscapedShips, clearSortieResourceGains } from '../../state';
import { clearSortieContext } from '../../../domain/service';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';
import { triggerNdockChanged } from '../../../features/alerts/module/ndockTrigger';

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
    }
  }
  private async handleSnapshot(payload: PortSnapshot, ts: number, deps: PersistDeps): Promise<void> {
    const snapshot = payload;
    // 先清空战斗 / 出击 / 退避 / 出击资源累计状态，再写入入港数据。否则 updateFromPort
    // 同步触发的 'all' 监听里 applyBattleHp 仍会读到旧的 battle.result，
    // 把战斗时的 hpAfter 覆盖在最新入港 HP 上，造成 panel/sidebar 闪现
    // 错误血量。
    clearBattleState();
    clearSortieContext();
    clearEscapedShips();
    clearSortieResourceGains();
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
    triggerNdockChanged();
  }

  private async handleKdock(payload: Kdock[], ts: number, deps: PersistDeps): Promise<void> {
    updateKdocks(payload)

    if (!deps.repos?.build) {
      console.warn('[persist][PORT_KDOCK] repository not provided');
      return;
    }
    const rows = payload.map(kdockToRow);
    await deps.repos.build.upsertBatch(rows);
  }

  private async handleShips(payload: Ship[], ts: number, deps: PersistDeps): Promise<void> {
    updateShips(payload);

    if (!deps.repos?.ship) {
      console.warn('[persist][PORT_SHIPS] repository not provided');
      return;
    }
    const rows = payload.map(shipToRow);
    await deps.repos.ship.upsertBatch(rows);
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
