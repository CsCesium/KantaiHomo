import { ApiMstSlotItemRaw } from "./mst_slotitem";

export interface ApiMstShipRaw { api_id: number; api_name: string; api_stype: number; [k: string]: unknown; }
export interface ApiMstMissionRaw { api_id: number; api_name: string; api_details: string; api_time: number; api_deck_num: number; [k: string]: unknown; }

export interface ApiStart2RespRaw {
  api_mst_ship: ApiMstShipRaw[];
  api_mst_slotitem: ApiMstSlotItemRaw[];
  api_mst_mission: ApiMstMissionRaw[];
  [k: string]: unknown;
}