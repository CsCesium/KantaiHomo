import type { EventType, EventBase } from '../../../domain/events/type';
import type {
  MissionStart,
  ExpeditionSlotState,
  MissionResult,
  MissionCatalogItem,
} from '../../../domain/models/expedition';
import { PersistDeps } from '../../../infra/deps';
import type { AnyMsg, Channel } from '../../../infra/net/wsClient/types';
import { RepositoryHub } from '../../../infra/store/repo/types';

export interface PersistEventBase extends EventBase {
  type: EventType;
}

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
  type: 'EXPEDITION';
  payload: ExpeditionEventPayload;
}

export type PersistEvent = PersistEventExpedition;

export interface ExpeditionRowWrite {
  deckId: number;
  missionId: number;
  progress: number;
  returnTime: number;
  updatedAt: number;
}
export interface ExpeditionsDAO {
  upsertBatch(rows: ExpeditionRowWrite[]): Promise<void>;
}

export interface RecentIdCache {
  has(id: string): boolean;
  add(id: string): void;
}

export interface DaoRegistry {
  EXPEDITION?: ExpeditionsDAO;
  // TODO：BATTLE?: BattlesDAO; QUEST?: QuestsDAO; ...
}

/** Handler 契约 */
export type PersistHandler = (ev: PersistEvent, deps: PersistDeps) => Promise<void>;

/** WS 桥接适配器契约 */
export interface PersistEventIdMaker {
  makeId(kind: string, keyA: number, keyB: number, ts: number): string;
}
export interface WsBridgeOptions {
  idMaker?: PersistEventIdMaker;
}
export interface MsgAdapter {
  /** 适配器绑定的通道 */
  readonly channel: Channel;
  /** 在所属通道内是否能处理该消息 */
  canHandle(msg: AnyMsg): boolean;
  /** 生成 0~N 条持久化事件 */
  toPersistEvents(msg: AnyMsg, idMaker: PersistEventIdMaker): PersistEvent[];
}
