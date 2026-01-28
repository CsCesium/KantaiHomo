import { ApiMstMissionRaw, ApiMstShipRaw, ApiMstSlotItemRaw } from "..";

export interface MasterData {
  shipsById: Record<number, ApiMstShipRaw>;
  slotItemsById: Record<number, ApiMstSlotItemRaw>;
  missionsById: Record<number, ApiMstMissionRaw>;
  updatedAt: number;
  extras?: Record<string, unknown>;
}
