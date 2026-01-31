// src/main/ets/features/router/persist/type.ets
import { AnyBattleEvt, AnyExpEvt, AnyPortEvt, AnySortieEvt,
  SessionBindEvent } from '../../../domain/events';

import { PersistDeps } from '../../../infra/deps/index';

export type { PersistDeps } from '../../../infra/deps/index';

export type HandlerEvent =
    | SessionBindEvent
    | AnyPortEvt
    | AnyExpEvt
    | AnySortieEvt
    | AnyBattleEvt;
  ;

export interface Handler {
  handle(ev: HandlerEvent, deps: PersistDeps): Promise<void>;
}
