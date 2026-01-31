// src/main/ets/features/router/persist/type.ets
import { AnyBattleEvt, AnyExpEvt, AnyPortEvt, AnySortieEvt, SessionBind,
  SessionBindEvent } from '../../../domain/events';
import type { EventType, EventBase } from '../../../domain/events/type';
import { NormalizedBattleResult } from '../../../domain/models';
import { ExpeditionSlotState, MissionStart, MissionResult, MissionCatalogItem,
  Admiral,
  Deck,
  Kdock,
  Materials,
  Ndock,
  PortSnapshot,
  Ship,
  SlotItem,
  BattleSegment,
  BattlePrediction,
  BattleRecord,
  FleetSnapshot,
  SortieCell} from '../../../domain/models/struct';

import { PersistDeps } from '../../../infra/deps/index';

export type { PersistDeps } from '../../../infra/deps/index';

export type HandlerEvent =
    | SessionBindEvent
    | AnyPortEvt
    | AnyExpEvt
    | AnySortieEvt
    | AnyBattleEvt;
  ;

export interface PersistHandler {
  handle(ev: HandlerEvent, deps: PersistDeps): Promise<void>;
}
