import { ApiMstShipRaw, ApiMstSlotitemRaw } from '../models/api/start2';
import { PayloadEvent } from './type';

export type ShipMasterCatalogEvent   = PayloadEvent<'SHIP_MASTER_CATALOG',   ApiMstShipRaw[]>
export type SlotItemMasterCatalogEvent = PayloadEvent<'SLOTITEM_MASTER_CATALOG', ApiMstSlotitemRaw[]>

export type AnyStart2Evt =
  | ShipMasterCatalogEvent
  | SlotItemMasterCatalogEvent;
