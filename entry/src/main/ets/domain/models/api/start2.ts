/**
 * api_start2/getData 响应类型
 * Master
 */

/** 舰船基础数据 (api_mst_ship) */
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
}

/** 舰船图像数据 (api_mst_shipgraph) */
export interface ApiMstShipgraphRaw {
  api_id: number;
  api_sortno?: number;
  api_filename: string;
  api_version?: string[];         // [图像版本, 语音版本, 母港语音版本]
  api_boko_n?: number[];
  api_boko_d?: number[];
  api_kaisyu_n?: number[];
  api_kaisyu_d?: number[];
  api_kaizo_n?: number[];
  api_kaizo_d?: number[];
  api_map_n?: number[];
  api_map_d?: number[];
  api_ensyuf_n?: number[];
  api_ensyuf_d?: number[];
  api_ensyue_n?: number[];
  api_battle_n?: number[];
  api_battle_d?: number[];
  api_weda?: number[];
  api_wedb?: number[];
}

/** 装备基础数据 (api_mst_slotitem) */
export interface ApiMstSlotitemRaw {
  api_id: number;
  api_sortno?: number;
  api_name: string;
  api_type: [number, number, number, number, number];  // [大分类, 图鉴, 装备类型, 图标, 航空机分类]

  api_taik?: number;    // 耐久
  api_souk?: number;    // 装甲
  api_houg?: number;    // 火力
  api_raig?: number;    // 雷装
  api_soku?: number;    // 速力
  api_baku?: number;    // 爆装
  api_tyku?: number;    // 对空
  api_tais?: number;    // 对潜
  api_atap?: number;    // 对地(未使用)
  api_houm?: number;    // 命中
  api_raim?: number;    // 雷击命中(未使用)
  api_houk?: number;    // 回避
  api_raik?: number;    // 雷击回避(未使用)
  api_bakk?: number;    // 爆击回避(未使用)
  api_saku?: number;    // 索敌
  api_sakb?: number;    // 索敌妨害(未使用)
  api_luck?: number;    // 运
  api_leng?: number;    // 射程

  api_rare?: number;    // 稀有度
  api_broken?: number[];  // 废弃资源 [燃,弹,钢,铝]
  api_usebull?: string;   // 射程修正?

  api_cost?: number;      // 航空机消耗
  api_distance?: number;  // 航空机航程

  api_version?: number;   // 图像版本
}

/** 装备类型 (api_mst_slotitem_equiptype) */
export interface ApiMstEquiptypeRaw {
  api_id: number;
  api_name: string;
  api_show_flg?: number;
}

/** 舰种 (api_mst_stype) */
export interface ApiMstStypeRaw {
  api_id: number;
  api_sortno?: number;
  api_name: string;
  api_scnt?: number;
  api_kcnt?: number;
  api_equip_type?: Record<string, number>;  // 可装备类型
}

/** 道具 (api_mst_useitem) */
export interface ApiMstUseitemRaw {
  api_id: number;
  api_usetype?: number;
  api_category?: number;
  api_name: string;
  api_description?: string[];
  api_price?: number;
}

/** 家具 (api_mst_furniture) */
export interface ApiMstFurnitureRaw {
  api_id: number;
  api_type: number;
  api_no: number;
  api_title: string;
  api_description: string;
  api_rarity: number;
  api_price: number;
  api_saleflg: number;
  api_season?: number;
  api_version?: number;
  api_outside_id?: number;
}

/** 任务 Master (api_mst_mission) */
export interface ApiMstMissionRaw {
  api_id: number;
  api_disp_no?: string;           // 显示编号 (A1, B2等)
  api_maparea_id: number;
  api_name: string;
  api_details: string;
  api_reset_type?: number;        // 0=普通, 1=月重置
  api_damage_type?: number;       // 0=无消耗, 1=小消耗, 2=大消耗
  api_time: number;               // 时间(分)
  api_deck_num?: number;          // 需要舰数
  api_difficulty?: number;        // 难度
  api_use_fuel?: number;          // 燃料消耗百分比
  api_use_bull?: number;          // 弹药消耗百分比
  api_win_item1?: [number, number]; // 奖励物品1 [id, count]
  api_win_item2?: [number, number]; // 奖励物品2 [id, count]
  api_win_mat_level?: number[];   // 资源奖励等级
  api_return_flag?: number;       // 是否可取消返回
  api_sample_fleet?: number[];    // 示例舰队
}

/** 海域信息 (api_mst_mapinfo) */
export interface ApiMstMapinfoRaw {
  api_id: number;
  api_maparea_id: number;
  api_no: number;
  api_name: string;
  api_level: number;
  api_opetext: string;
  api_infotext: string;
  api_item?: number[];
  api_max_maphp?: number;
  api_required_defeat_count?: number;
  api_sally_flag?: number[];
}

/** 海域区域 (api_mst_maparea) */
export interface ApiMstMapareaRaw {
  api_id: number;
  api_name: string;
  api_type: number;
}

/** BGM (api_mst_bgm) */
export interface ApiMstBgmRaw {
  api_id: number;
  api_name: string;
}

/** api_start2/getData 完整响应 */
export interface ApiStart2DataRaw {
  api_mst_ship: ApiMstShipRaw[];
  api_mst_shipgraph?: ApiMstShipgraphRaw[];
  api_mst_slotitem: ApiMstSlotitemRaw[];
  api_mst_slotitem_equiptype?: ApiMstEquiptypeRaw[];
  api_mst_stype: ApiMstStypeRaw[];
  api_mst_useitem?: ApiMstUseitemRaw[];
  api_mst_furniture?: ApiMstFurnitureRaw[];
  api_mst_mission?: ApiMstMissionRaw[];
  api_mst_mapinfo?: ApiMstMapinfoRaw[];
  api_mst_maparea?: ApiMstMapareaRaw[];
  api_mst_bgm?: ApiMstBgmRaw[];
  api_mst_equip_exslot?: number[];
  api_mst_equip_exslot_ship?: Array<{
    api_slotitem_id: number;
    api_ship_ids: number[];
  }>;
}
