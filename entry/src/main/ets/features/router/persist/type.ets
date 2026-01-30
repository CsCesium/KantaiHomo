// src/main/ets/features/router/persist/type.ets
import { SessionBind } from '../../../domain/events';
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

export interface PersistEventBase extends EventBase {
  type: EventType
}

/* ---------------- session ---------------- */
export interface SessionBindPayload {
  kind:'session'
  data: SessionBind
}

export interface PersistSessionBindEvent extends PersistEventBase {
  type: 'SESSION_BIND';
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
/* ---------------- Battle ---------------- */

interface BattlePayLoadData {
  apiPath: string;
  segment: BattleSegment;
  prediction: BattlePrediction;
}

export interface BattleDayPayload {
  kind: 'day';
  data: BattlePayLoadData;
}



export interface BattleNightPayload {
  kind: 'night';
  data: BattlePayLoadData;
}

interface BattleResultData {
  record: BattleRecord;
  normalizedResult: NormalizedBattleResult;
}

export interface BattleResultPayload {
  kind: 'result';
  data: BattleResultData;
}

export type BattleEventPayload = BattleDayPayload | BattleNightPayload | BattleResultPayload;

export interface PersistEventBattle extends PersistEventBase {
  type: 'BATTLE_START' | 'BATTLE_RESULT';
  payload: BattleEventPayload;
}

/* ---------------- Sortie ---------------- */
interface SortieStartData {
  mapAreaId: number;
  mapInfoNo: number;
  deckId: number;
  cellId: number;
  combinedType: number;
  fleetSnapshot: FleetSnapshot;
  fleetSnapshotEscort?: FleetSnapshot;
}

export interface SortieStartPayload {
  kind: 'start';
  data: SortieStartData;
}

interface SortieNextData {
  cell: SortieCell;
}

export interface SortieNextPayload {
  kind: 'next';
  data: SortieNextData;
}

export type SortieEventPayload = SortieStartPayload | SortieNextPayload;

export interface PersistEventSortie extends PersistEventBase {
  type: 'SORTIE_START' | 'SORTIE_NEXT';
  payload: SortieEventPayload;
}

//TODO:OTHER EVENT

export type PersistEvent =
  PersistSessionBindEvent
    | PersistEventPort
    | PersistEventExpedition
    | PersistEventBattle
    | PersistEventSortie;

export interface PersistHandler {
  handle(ev: PersistEvent, deps: PersistDeps): Promise<void>;
}
