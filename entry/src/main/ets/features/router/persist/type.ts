// src/main/ets/features/router/persist/type.ets
import { AnyBattleEvt, AnyExpEvt, AnyPortEvt, AnyQuestEvt, AnySortieEvt,
  SessionBindEvent } from '../../../domain/events';
import { AnyStart2Evt } from '../../../domain/events/start2';

import { PersistDeps } from '../../../infra/deps/index';

export type { PersistDeps } from '../../../infra/deps/index';

export type HandlerEvent =
    | SessionBindEvent
    | AnyPortEvt
    | AnyQuestEvt
    | AnyStart2Evt
    | AnyExpEvt
    | AnySortieEvt
    | AnyBattleEvt;
  ;

export interface Handler {
  handle(ev: HandlerEvent, deps: PersistDeps): Promise<void>;
}
