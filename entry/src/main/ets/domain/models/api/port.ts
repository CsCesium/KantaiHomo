import type { ApiShipRaw } from './ship';
import type { ApiNdockRespRaw } from './nyukyo';
import { ApiDeckMissionTuple } from './mission';

export interface ApiMaterialItemRaw {
  api_id: number;
  api_value: number;
}

export interface ApiDeckPortRaw {
  api_id: number;
  api_name: string;
  api_mission: ApiDeckMissionTuple;
  api_ship: number[]; // ship instance ids, -1=空位
}

export interface ApiBasicRaw {
  api_member_id: number;
  api_nickname: string;
  api_level: number;
  api_experience: number;

  api_max_chara: number;
  api_max_slotitem: number;

  api_large_dock?: number;
}

export interface ApiPortDataRaw {
  api_material: ApiMaterialItemRaw[];
  api_deck_port: ApiDeckPortRaw[];
  api_ndock: ApiNdockRespRaw[];
  api_ship: ApiShipRaw[];
  api_basic: ApiBasicRaw;

  api_combined_flag?: number;
  api_p_bgm_id?: number;

  api_parallel_quest_count?: number;
  api_dest_ship_slot?: number;

  api_event_object?: unknown;
  api_plane_info?: unknown;
  api_log?: unknown;
}