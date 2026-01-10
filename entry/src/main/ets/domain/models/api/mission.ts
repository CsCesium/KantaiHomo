export type ApiDeckMissionTuple = [
  state: number,
  missionId: number,
  returnTimeMs: number,
  reserved: number,
];

export interface ApiMissionStartRespRaw {
  api_complatetime: number;       // unitime(ms)
  api_complatetime_str: string;
}

export interface ApiMissionResultRespRaw {
  api_ship_id: number[];
  api_clear_result: 0 | 1 | 2;
  api_get_exp: number;
  api_member_lv: number;
  api_member_exp: number;

  api_get_ship_exp: number[];
  api_get_exp_lvup: number[][];

  api_maparea_name: string;
  api_detail: string;
  api_quest_name: string;
  api_quest_level: number;

  api_get_material?: number[];

  api_useitem_flag: number[];

  api_get_item1?: {
    api_useitem_id: number;
    api_useitem_name: string | null;
    api_useitem_count: number;
  };

  api_get_item2?: {
    api_useitem_id: number;
    api_useitem_name: string | null;
    api_useitem_count: number;
  };
}

export interface ApiMissionCatalogRaw {
  api_id: number;
  api_disp_no: string;
  api_maparea_id: number;
  api_name: string;
  api_details: string;
  api_reset_type: 0 | 1;
  api_damage_type: 0 | 1 | 2;
  api_time: number;                 // 分
  api_deck_num: number;             // 需要舰船数
  api_difficulty: number;
  api_use_fuel: number;             // %
  api_use_bull: number;             // %

  api_win_item1?: [number, number];
  api_win_item2?: [number, number];
  api_win_mat_level?: [number, number, number, number];

  api_return_flag?: 0 | 1;
  api_sample_fleet?: number[];
}