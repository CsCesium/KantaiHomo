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

export interface PersistEventBaseLite extends EventBase {
  type: EventType
}
export interface PersistEventBase extends PersistEventBaseLite {
  raw: string
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

export interface PersistEventExpeditionLite extends PersistEventBaseLite {
  type: 'EXPEDITION'
  payload: ExpeditionEventPayload
}

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
export interface PersistEventBattleLite extends PersistEventBaseLite {
  type: 'BATTLE_RESULT'
  payload: BattleEventPayload
}
//TODO:OTHER EVENT

export type PersistEvent = PersistEventExpedition
  | PersistEventBattle;

export type PersistEventLite = PersistEventExpeditionLite
  | PersistEventBattleLite ;

export interface PersistHandler {
  handle(ev: PersistEvent, deps: PersistDeps): Promise<void>;
}
