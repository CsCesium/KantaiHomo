import { ApiMstShipRaw, ApiMstSlotitemRaw, ApiMstMissionRaw } from '../models/api/start2';
import { PayloadEvent } from './type';

export type ShipMasterCatalogEvent     = PayloadEvent<'SHIP_MASTER_CATALOG',     ApiMstShipRaw[]>
export type SlotItemMasterCatalogEvent = PayloadEvent<'SLOTITEM_MASTER_CATALOG', ApiMstSlotitemRaw[]>
export type MissionMasterCatalogEvent  = PayloadEvent<'MISSION_MASTER_CATALOG',  ApiMstMissionRaw[]>

export type AnyStart2Evt =
  | ShipMasterCatalogEvent
  | SlotItemMasterCatalogEvent
  | MissionMasterCatalogEvent;
