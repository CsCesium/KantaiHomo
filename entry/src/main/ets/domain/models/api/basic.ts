/**
 * 提督基本信息类型 (api_basic)
 * 来源: api_port/port, api_get_member/require_info
 */
export interface ApiBasicRaw {
  api_member_id: number;
  api_nickname: string;
  api_nickname_id?: string;
  api_active_flag?: number;
  api_starttime?: number;
  api_level: number;
  api_rank?: number;
  api_experience: number;
  api_fleetname?: string;
  api_comment?: string;
  api_comment_id?: string;
  api_max_chara: number;       // 最大舰船数
  api_max_slotitem: number;    // 最大装备数
  api_max_kagu?: number;       // 最大家具数
  api_playtime?: number;
  api_tutorial?: number;
  api_furniture?: number[];
  api_count_deck?: number;
  api_count_kdock?: number;
  api_count_ndock?: number;
  api_fcoin?: number;          // 家具币
  api_st_win?: number;
  api_st_lose?: number;
  api_ms_count?: number;
  api_ms_success?: number;
  api_pt_win?: number;
  api_pt_lose?: number;
  api_pt_challenged?: number;
  api_pt_challenged_win?: number;
  api_firstflag?: number;
  api_tutorial_progress?: number;
  api_pvp?: number[];
  api_medals?: number;
  api_large_dock?: 0 | 1;      // 大型建造是否开放

  [k: string]: unknown;
}
