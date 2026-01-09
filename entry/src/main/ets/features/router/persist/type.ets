// src/main/ets/features/router/persist/type.ets
import type { EventType, EventBase } from '../../../domain/events/type';
import type {
  MissionStart,
  ExpeditionSlotState,
  MissionResult,
  MissionCatalogItem,
} from '../../../domain/models/expedition';
import { PersistDeps } from '../../../infra/deps/index';

export type { PersistDeps } from '../../../infra/deps/index';

export interface PersistEventBase extends EventBase {
  type: EventType
}


/* ---------------- Expedition ---------------- */

export interface ExpeditionEventPayloadSlotState {
  kind: 'slotState';
  data: ExpeditionSlotState | ExpeditionSlotState[];
}
export interface ExpeditionEventPayloadStart {
  kind: 'start';
  data: MissionStart;
}
export interface ExpeditionEventPayloadResult {
  kind: 'result';
  data: MissionResult;
}
export interface ExpeditionEventPayloadCatalog {
  kind: 'catalog';
  data: MissionCatalogItem[];
}
export type ExpeditionEventPayload =
  | ExpeditionEventPayloadSlotState
    | ExpeditionEventPayloadStart
    | ExpeditionEventPayloadResult
    | ExpeditionEventPayloadCatalog;



export interface PersistEventExpedition extends PersistEventBase {
  type: 'EXPEDITION'
  payload: ExpeditionEventPayload
}
/* ---------------- Battle (WIP)----------------*/
export interface BattleEventPayload {
  kind: 'result'
  //data:
}

export interface PersistEventBattle extends PersistEventBase {
  type: 'BATTLE_RESULT'
  payload: BattleEventPayload
}

//TODO:OTHER EVENT

export type PersistEvent = PersistEventExpedition
  | PersistEventBattle;

export interface PersistHandler {
  handle(ev: PersistEvent, deps: PersistDeps): Promise<void>;
}
