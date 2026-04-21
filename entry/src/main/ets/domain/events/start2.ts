import { ApiMstShipRaw, ApiMstSlotitemRaw, ApiMstMissionRaw, ApiMstShipgraphRaw } from '../models/api/start2';
import { PayloadEvent } from './type';

export type ShipMasterCatalogEvent     = PayloadEvent<'SHIP_MASTER_CATALOG',     ApiMstShipRaw[]>
export type SlotItemMasterCatalogEvent = PayloadEvent<'SLOTITEM_MASTER_CATALOG', ApiMstSlotitemRaw[]>
export type MissionMasterCatalogEvent  = PayloadEvent<'MISSION_MASTER_CATALOG',  ApiMstMissionRaw[]>

export interface ShipGraphCatalogPayload {
  graphs: ApiMstShipgraphRaw[];
  serverBase: string;
}
export type ShipGraphCatalogEvent = PayloadEvent<'SHIP_GRAPH_CATALOG', ShipGraphCatalogPayload>

export type AnyStart2Evt =
  | ShipMasterCatalogEvent
  | SlotItemMasterCatalogEvent
  | MissionMasterCatalogEvent
  | ShipGraphCatalogEvent;
