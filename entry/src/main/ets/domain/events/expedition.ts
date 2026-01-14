import { MissionStart, ExpeditionSlotState, MissionResult, MissionCatalogItem } from '../models'
import { PayloadEvent } from './type'

export type ExpeditionStartEvent =
  PayloadEvent<'EXPEDITION_START', MissionStart>

export type ExpeditionUpdateEvent =
  PayloadEvent<'EXPEDITION_UPDATE', ExpeditionSlotState[]>

export type ExpeditionResultEvent =
  PayloadEvent<'EXPEDITION_RESULT', MissionResult>

export type ExpeditionCatalogEvent =
  PayloadEvent<'EXPEDITION_CATALOG', MissionCatalogItem[]>