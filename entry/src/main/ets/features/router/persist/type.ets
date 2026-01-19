// src/main/ets/features/router/persist/type.ets
import { SessionBind } from '../../../domain/events';
import type { EventType, EventBase } from '../../../domain/events/type';
import { ExpeditionSlotState, MissionStart, MissionResult, MissionCatalogItem,
  Admiral,
  Deck,
  Kdock,
  Materials,
  Ndock,
  PortSnapshot,
  Ship,
  SlotItem } from '../../../domain/models/struct';

import { PersistDeps } from '../../../infra/deps/index';

export type { PersistDeps } from '../../../infra/deps/index';

export interface PersistEventBase extends EventBase {
  type: EventType
}

/* ---------------- session ---------------- */
export interface SessionBindPayload {
  kind:'session'
  data: SessionBind
}

export interface PersistSessionBindEvent extends PersistEventBase {
  type: 'PORT';
  payload: SessionBindPayload;
}
/* ---------------- Port ---------------- */
export interface PortEventPayloadSnapshot {
  kind:'snapshot'
  data:PortSnapshot;
}
export interface PortEventPayloadBasic {
  kind:'admiral'
  data:Admiral;
}
export interface PortEventPayloadResources {
  kind:'material'
  data:Materials;
}
export interface PortEventPayloadFleets {
  kind:'fleet'
  data:Deck[];
}
export interface PortEventPayloadNdock {
  kind:'ndock'
  data:Ndock[];
}
export interface PortEventPayloadKdock {
  kind:'kdock'
  data:Kdock[];
}
export interface PortEventPayloadShips {
  kind:'ship'
  data:Ship[];
}
export interface PortEventPayloadSlotItems {
  kind:'slotitem'
  data:SlotItem[];
}

export type PortEventPayloads =
  PortEventPayloadSnapshot
  |PortEventPayloadBasic
  |PortEventPayloadResources
  |PortEventPayloadFleets
  |PortEventPayloadNdock
  |PortEventPayloadKdock
  |PortEventPayloadShips
  |PortEventPayloadSlotItems;

export interface PersistEventPort extends PersistEventBase {
  type:'PORT';
  payload:PortEventPayloads;
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

export type PersistEvent =
  PersistSessionBindEvent
  | PersistEventPort
  | PersistEventExpedition
  | PersistEventBattle;

export interface PersistHandler {
  handle(ev: PersistEvent, deps: PersistDeps): Promise<void>;
}
