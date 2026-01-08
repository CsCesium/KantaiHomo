import { PayloadEvent } from './type'
import type { MissionStart, ExpeditionSlotState, MissionResult, MissionCatalogItem } from '../models/expedition'

export type ExpeditionStartEvent =
  PayloadEvent<'EXPEDITION_START', MissionStart>

export type ExpeditionUpdateEvent =
  PayloadEvent<'EXPEDITION_UPDATE', ExpeditionSlotState[]>

export type ExpeditionResultEvent =
  PayloadEvent<'EXPEDITION_RESULT', MissionResult>

export type ExpeditionCatalogEvent =
  PayloadEvent<'EXPEDITION_CATALOG', MissionCatalogItem[]>