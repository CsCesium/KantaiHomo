// src/main/ets/features/router/persist/type.ets
import type { AnyBattleEvt, AnyExpEvt,
    AnyMapInfoEvt,
    AnyPortEvt, AnyQuestEvt, AnySortieEvt,
  SessionBindEvent } from '../../../domain/events';
import type { AnyStart2Evt } from '../../../domain/events/start2';
import type { AnyRankingEvt } from '../../../domain/events/ranking';

import type { PersistDeps } from '../../../infra/deps/index';

export type { PersistDeps } from '../../../infra/deps/index';

export type HandlerEvent =
    | SessionBindEvent
    | AnyPortEvt
    | AnyQuestEvt
    | AnyStart2Evt
    | AnyExpEvt
    | AnySortieEvt
    | AnyBattleEvt
    | AnyRankingEvt
    | AnyMapInfoEvt;

export interface Handler {
  handle(ev: HandlerEvent, deps: PersistDeps): Promise<void>;
}
