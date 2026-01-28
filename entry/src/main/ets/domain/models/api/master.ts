/**
 * Master 数据基础类型
 * 来源: api_start2/getData
 */

import { ApiMstSlotItemRaw } from "./mst_slotitem";

/** 舰船 Master (api_mst_ship) */
export interface ApiMstShipRaw {
  api_id: number;
  api_sortno?: number;
  api_sort_id?: number;
  api_name: string;
  api_yomi?: string;
  api_stype: number;
  api_ctype?: number;
  api_afterlv?: number;
  api_aftershipid?: string;  // 字符串 "0" 表示无

  api_taik?: [number, number];    // 耐久 [初期, 最大]
  api_souk?: [number, number];    // 装甲
  api_houg?: [number, number];    // 火力
  api_raig?: [number, number];    // 雷装
  api_tyku?: [number, number];    // 对空
  api_tais?: [number, number];    // 对潜 (护卫空母有)
  api_luck?: [number, number];    // 运

  api_soku?: number;              // 速力 0=基地, 5=低速, 10=高速, 15=高速+, 20=最速
  api_leng?: number;              // 射程 0=无, 1=短, 2=中, 3=长, 4=超长

  api_slot_num?: number;          // 装备槽数
  api_maxeq?: number[];           // 搭载数

  api_buildtime?: number;         // 建造时间(分)
  api_broken?: number[];          // 解体获得资源
  api_powup?: number[];           // 近代化改修值

  api_backs?: number;             // 稀有度
  api_getmes?: string;            // 获得台词

  api_afterfuel?: number;         // 改装所需燃料
  api_afterbull?: number;         // 改装所需弹药
  api_fuel_max?: number;          // 最大燃料
  api_bull_max?: number;          // 最大弹药

  api_voicef?: number;            // 语音标记 1=放置, 2=报时, 4=特殊放置

  [k: string]: unknown;
}

/** 远征 Master (api_mst_mission) */
export interface ApiMstMissionRaw {
  api_id: number;
  api_disp_no?: string;           // 显示编号 (A1, B2等)
  api_maparea_id: number;
  api_name: string;
  api_details: string;
  api_time: number;               // 时间(分)
  api_deck_num?: number;          // 需要舰数
  api_difficulty?: number;        // 难度
  api_reset_type?: number;        // 0=普通, 1=月重置
  api_damage_type?: number;       // 0=无消耗, 1=小消耗, 2=大消耗
  api_use_fuel?: number;          // 燃料消耗百分比
  api_use_bull?: number;          // 弹药消耗百分比
  api_win_item1?: [number, number]; // 奖励物品1 [id, count]
  api_win_item2?: [number, number]; // 奖励物品2 [id, count]
  api_win_mat_level?: number[];   // 资源奖励等级
  api_return_flag?: number;       // 是否可取消返回
  api_sample_fleet?: number[];    // 示例舰队

  [k: string]: unknown;
}

/** api_start2 响应 (简化版，完整版见 start2.ts) */
export interface ApiStart2RespRaw {
  api_mst_ship: ApiMstShipRaw[];
  api_mst_slotitem: ApiMstSlotItemRaw[];
  api_mst_mission: ApiMstMissionRaw[];
  [k: string]: unknown;
}
