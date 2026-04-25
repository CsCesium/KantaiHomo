/**
 * features/simulator/state_adapter.ts
 *
 * 将项目 GameState 适配为 BattlePredictionService 所需的 GameStateFacade。
 * 使用鸭子类型，避免循环依赖。
 */

import { getDecks, getShip } from '../state/game_state';
import { getSortieContext } from '../../domain/service/sortie';
import type { GameStateFacade } from './battle_prediction_service';
import { DeckSnapshotLike, ShipStateLike } from './fleet_builder';

class GameStateAdapterImpl implements GameStateFacade {
  getDecks(): DeckSnapshotLike[] {
    return getDecks().map(d => ({
      id:      d.deckId,
      shipIds: [...d.shipUids],
    }));
  }

  getShips(): Map<number, ShipStateLike> {
    const m = new Map<number, ShipStateLike>();
    for (const deck of getDecks()) {
      for (const uid of deck.shipUids) {
        if (uid <= 0 || m.has(uid)) continue;
        const s = getShip(uid);
        if (s == null) continue;
        m.set(uid, {
          uid:          s.uid,
          api_ship_id:  s.masterId,
          api_maxhp:    s.hpMax,
          api_nowhp:    s.hpNow,
          api_slot:     [...s.slots],
          api_slot_ex:  s.exSlot > 0 ? s.exSlot : undefined,
        });
      }
    }
    return m;
  }

  getCombinedFleetType(): number {
    return getSortieContext()?.combinedType ?? 0;
  }
}

export const gameStateAdapter: GameStateFacade = new GameStateAdapterImpl();
