/**
 * BattleResult API 类型
 * 对应 api_req_sortie/battleresult, api_req_practice/battle_result, api_req_combined_battle/battleresult
 */

export interface ApiBattleResultShipExpRaw {
  api_id: number;
  api_exp: number[];  // [before, after, ...]
}

export interface ApiBattleResultGetShipRaw {
  api_ship_id: number;
  api_ship_type: string;
  api_ship_name: string;
  api_ship_getmes: string;
}

export interface ApiBattleResultRaw {
  // 战斗结果等级
  api_win_rank: string;  // 'S' | 'A' | 'B' | 'C' | 'D' | 'E'

  // 经验
  api_get_exp: number;
  api_get_base_exp: number;
  api_get_ship_exp: number[];  // 每艘舰经验
  api_get_exp_lvup: number[][]; // 升级经验 [当前exp, 下级exp]

  // MVP
  api_mvp?: number;           // 1-based index
  api_mvp_combined?: number;  // 联合舰队第二舰队 MVP

  // 敌方
  api_enemy_info: {
    api_level: string;
    api_rank: string;
    api_deck_name: string;
  };

  // 掉落
  api_get_ship?: ApiBattleResultGetShipRaw;
  api_get_useitem?: {
    api_useitem_id: number;
    api_useitem_name?: string;
  };
  api_get_slotitem?: {
    api_slotitem_id: number;
  };

  // 受损flag
  api_destsf?: number;  // 沉没flag

  // 逃跑相关
  api_escape?: number;  // 可逃跑
  api_escape_flag?: number[];  // [main退避, escort退避]

  // 联合舰队
  api_get_ship_exp_combined?: number[];
  api_get_exp_lvup_combined?: number[][];

  // 其他
  api_quest_name?: string;
  api_quest_level?: number;

  api_first_clear?: number;  // 首次通关
  api_mapcell_incentive?: number;  // 点位奖励
}

/** 演习结果 (api_req_practice/battle_result) */
export interface ApiPracticeBattleResultRaw {
  api_win_rank: string;
  api_get_exp: number;
  api_get_base_exp: number;
  api_get_ship_exp: number[];
  api_get_exp_lvup: number[][];
  api_mvp?: number;
  api_member_lv: number;
  api_member_exp: number;
  api_get_member_exp: number;
  api_enemy_info: {
    api_level: string;
    api_rank: string;
    api_deck_name: string;
  };
}
