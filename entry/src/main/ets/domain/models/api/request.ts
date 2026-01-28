/**
 * api_req_* 请求类型定义
 */

// Re-export existing response types
export type { ApiMissionStartRespRaw, ApiMissionResultRespRaw } from './mission';
export type { ApiHokyuChargeRespRaw, ApiHokyuChargeReqRaw } from './charge';
export type { ApiMapStartRespRaw, ApiMapNextRespRaw } from './map';

// ==================== 远征请求 ====================

/** 远征开始请求参数 */
export interface ApiReqMissionStartParams {
  api_mission_id: string;
  api_deck_id: string;
}

/** 远征返回请求参数 */
export interface ApiReqMissionReturnParams {
  api_deck_id: string;
}

// ==================== 入渠请求 ====================

/** 入渠开始请求参数 */
export interface ApiReqNyukyoStartParams {
  api_ship_id: string;
  api_ndock_id: string;
  api_highspeed: string;     // 0=不使用高速修复, 1=使用
}

/** 高速修复请求参数 */
export interface ApiReqNyukyoSpeedchangeParams {
  api_ndock_id: string;
}

// ==================== 建造请求 ====================

/** 建造请求参数 */
export interface ApiReqKousyouCreateshipParams {
  api_item1: string;         // 燃料
  api_item2: string;         // 弹药
  api_item3: string;         // 钢材
  api_item4: string;         // 铝土
  api_item5: string;         // 开发资材
  api_kdock_id: string;
  api_highspeed?: string;    // 高速建造
  api_large_flag?: string;   // 大型建造标记
}

/** 获取建造舰船请求参数 */
export interface ApiReqKousyouGetshipParams {
  api_kdock_id: string;
}

/** 废弃舰船请求参数 */
export interface ApiReqKousyouDestroyshipParams {
  api_ship_id: string;       // 逗号分隔
  api_slot_dest_flag?: string;
}

/** 废弃装备请求参数 */
export interface ApiReqKousyouDestroyitem2Params {
  api_slotitem_ids: string;  // 逗号分隔
}

/** 废弃装备响应 */
export interface ApiReqKousyouDestroyitem2RespRaw {
  api_get_material: number[];
}

/** 开发请求参数 */
export interface ApiReqKousyouCreateitemParams {
  api_item1: string;         // 燃料
  api_item2: string;         // 弹药
  api_item3: string;         // 钢材
  api_item4: string;         // 铝土
}

/** 开发响应 */
export interface ApiReqKousyouCreateitemRespRaw {
  api_create_flag: 0 | 1;
  api_shizai_flag?: number;
  api_slot_item?: {
    api_id: number;
    api_slotitem_id: number;
  };
  api_material: number[];
  api_type3?: number;
  api_unsetslot?: Record<string, number[]>;
  api_fdata?: string;
}

/** 改修工厂请求参数 */
export interface ApiReqKousyouRemodelslotParams {
  api_slot_id: string;
  api_id?: string;           // 协力舰船ID
  api_certain_flag?: string; // 确实化
}

/** 改修工厂响应 */
export interface ApiReqKousyouRemodelslotRespRaw {
  api_remodel_flag: 0 | 1;
  api_remodel_id: number[];
  api_after_material: number[];
  api_after_slot?: {
    api_id: number;
    api_slotitem_id: number;
    api_locked: 0 | 1;
    api_level: number;
  };
  api_use_slot_id?: number[];
  api_voice_id?: number;
  api_voice_ship_id?: number;
}

// ==================== 编成请求 ====================

/** 编成变更请求参数 */
export interface ApiReqHenseiChangeParams {
  api_id: string;            // 舰队ID
  api_ship_id: string;       // 舰船ID (-1=解除, -2=旗舰以外全解除)
  api_ship_idx?: string;     // 位置
}

/** 联合舰队编成请求参数 */
export interface ApiReqHenseiCombinedParams {
  api_combined_type: string; // 0=解除, 1=机动, 2=水上, 3=运输
}

/** 联合舰队编成响应 */
export interface ApiReqHenseiCombinedRespRaw {
  api_combined: 0 | 1;
}

/** 预设编成展开请求参数 */
export interface ApiReqHenseiPresetSelectParams {
  api_preset_no: string;
  api_deck_id: string;
}

// ==================== 改装请求 ====================

/** 换装请求参数 */
export interface ApiReqKaisouSlotsetParams {
  api_id: string;            // 舰船ID
  api_item_id: string;       // 装备ID (-1=卸下)
  api_slot_idx: string;      // 槽位
}

/** 换装(Ex)请求参数 */
export interface ApiReqKaisouSlotsetExParams {
  api_id: string;
  api_item_id: string;
}

/** 全解除请求参数 */
export interface ApiReqKaisouUnsetslotAllParams {
  api_id: string;
}

/** 改装请求参数 */
export interface ApiReqKaisouRemodelingParams {
  api_id: string;
}

/** 补强增设开放请求参数 */
export interface ApiReqKaisouOpenExslotParams {
  api_id: string;
}

/** 婚戒请求参数 */
export interface ApiReqKaisouMarriageParams {
  api_id: string;
}

// ==================== 出击请求 ====================

/** 出击开始请求参数 */
export interface ApiReqMapStartParams {
  api_maparea_id: string;
  api_mapinfo_no: string;
  api_deck_id: string;
  api_formation_id?: string;
  api_serial_cid?: string;
}

/** 进击请求参数 */
export interface ApiReqMapNextParams {
  api_recovery_type?: string; // 退避类型
}

// ==================== 任务请求 ====================

/** 任务接受请求参数 */
export interface ApiReqQuestStartParams {
  api_quest_id: string;
}

/** 任务放弃请求参数 */
export interface ApiReqQuestStopParams {
  api_quest_id: string;
}

/** 任务奖励领取请求参数 */
export interface ApiReqQuestClearitemgetParams {
  api_quest_id: string;
  api_select_no?: string;    // 选择奖励
}

/** 任务奖励领取响应 */
export interface ApiReqQuestClearitemgetRespRaw {
  api_material: number[];
  api_bounus_count: number;
  api_bounus?: Array<{
    api_type: number;
    api_count: number;
    api_item?: {
      api_id?: number;
      api_slotitem_id?: number;
      api_name?: string;
      api_slotitem_level?: number;
    };
  }>;
}

// ==================== 母港请求 ====================

/** 家具购买请求参数 */
export interface ApiReqFurnitureBuyParams {
  api_type: string;
  api_no: string;
}

/** 家具更换请求参数 */
export interface ApiReqFurnitureChangeParams {
  api_floor: string;
  api_wallpaper: string;
  api_window: string;
  api_wallhanging: string;
  api_shelf: string;
  api_desk: string;
  api_season?: string;
}

/** 给粮舰使用请求参数 */
export interface ApiReqMemberItemuseCondParams {
  api_use_type: string;      // 1=间宫, 2=伊良湖, 3=两者
  api_deck_id: string;
}
