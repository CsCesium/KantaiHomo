import { EventBase } from './type'
import type { MissionStart, ExpeditionSlotState, MissionResult, MissionCatalogItem } from '../models/expedition'

export interface ExpeditionStartEvent extends EventBase {
  type: 'EXPEDITION_START';
  payload: MissionStart;
}

export interface ExpeditionUpdateEvent extends EventBase {
  type: 'EXPEDITION_UPDATE';
  payload: ExpeditionSlotState[];
}

export interface ExpeditionResultEvent extends EventBase {
  type: 'EXPEDITION_RESULT';
  payload: MissionResult;
}

export interface ExpeditionCatalogEvent extends EventBase {
  type: 'EXPEDITION_CATALOG';
  payload: MissionCatalogItem[];
}