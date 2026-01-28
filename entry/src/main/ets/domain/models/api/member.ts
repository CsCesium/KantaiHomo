/**
 * api_get_member/* 响应类型
 */

import type { ApiShipRaw } from './ship';
import type { ApiDeckPortRaw } from './deck';
import type { ApiSlotItemRaw, ApiUnsetSlotRaw } from './slotitem';
import type { ApiUseItemRaw } from './useitem';
import type { ApiMaterialItemRaw } from './materials';
import type { ApiNdockRaw } from './n_dock';
import type { ApiKdockRaw } from './k_dock';
import type { ApiBasicRaw } from './basic';
import type { ApiQuestListRespRaw } from './quest';

// Re-export for convenience
export type { ApiShipRaw } from './ship';
export type { ApiDeckPortRaw } from './deck';
export type { ApiSlotItemRaw, ApiUnsetSlotRaw } from './slotitem';

/** api_get_member/ship2 响应 */
export interface ApiShip2RespRaw {
  api_ship_data: ApiShipRaw[];
}

/** api_get_member/ship3 响应 */
export interface ApiShip3RespRaw {
  api_ship_data: ApiShipRaw[];
  api_deck_data: ApiDeckPortRaw[];
  api_slot_data?: Record<string, number[]>;
}

/** api_get_member/ship_deck 响应 */
export interface ApiShipDeckRespRaw {
  api_ship_data: ApiShipRaw[];
  api_deck_data: ApiDeckPortRaw[];
}

/** api_get_member/deck 响应 */
export interface ApiDeckRespRaw {
  api_deck_data: ApiDeckPortRaw[];
}

/** api_get_member/slot_item 响应 */
export interface ApiSlotItemRespRaw {
  api_slot_item: ApiSlotItemRaw[];
}

/** api_get_member/useitem 响应 */
export interface ApiUseitemRespRaw {
  api_useitem: ApiUseItemRaw[];
}

/** api_get_member/material 响应 */
export interface ApiMaterialRespRaw {
  api_material: ApiMaterialItemRaw[];
}

/** api_get_member/ndock 响应 - 数组形式 */
export type ApiNdockRespRaw = ApiNdockRaw[];

/** api_get_member/kdock 响应 - 数组形式 */
export type ApiKdockRespRaw = ApiKdockRaw[];

/** api_get_member/questlist 响应 - 直接引用 */
export type { ApiQuestListRespRaw };

/** api_get_member/mapinfo 响应 */
export interface ApiMapinfoItemRaw {
  api_id: number;
  api_cleared: number;
  api_exboss_flag?: number;
  api_defeat_count?: number;
  api_now_maphp?: number;
  api_max_maphp?: number;
  api_gauge_type?: number;
  api_gauge_num?: number;
  api_eventmap?: {
    api_now_maphp: number;
    api_max_maphp: number;
    api_state: number;
    api_selected_rank?: number;
    api_gauge_type?: number;
    api_gauge_num?: number;
  };
  api_s_no?: number;
}

export interface ApiMapinfoRespRaw {
  api_map_info: ApiMapinfoItemRaw[];
  api_air_base?: ApiBaseAirCorpsRaw[];
}

/** 基地航空队 (api_get_member/base_air_corps) */
export interface ApiBaseAirCorpsRaw {
  api_area_id: number;
  api_rid: number;
  api_name: string;
  api_distance: {
    api_base: number;
    api_bonus: number;
  };
  api_action_kind: number;  // 0=待机, 1=出撃, 2=防空, 3=退避, 4=休息
  api_plane_info: ApiBasePlaneRaw[];
}

export interface ApiBasePlaneRaw {
  api_squadron_id: number;
  api_state: number;        // 0=未配置, 1=配置中, 2=疲劳
  api_slotid: number;       // 装备实例ID
  api_count?: number;       // 当前搭载数
  api_max_count?: number;   // 最大搭载数
  api_cond?: number;        // 疲劳度 1=正常, 2=橙疲, 3=红疲
}

/** api_get_member/mission 响应 */
export interface ApiMissionStateRaw {
  api_mission_id: number;
  api_state: number;    // 0=未开放, 1=可远征, 2=远征中
}

export interface ApiMissionListRespRaw {
  api_mission: ApiMissionStateRaw[];
}
