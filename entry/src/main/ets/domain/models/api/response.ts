import { ApiBasicRaw, ApiMaterialItemRaw, ApiDeckPortRaw, ApiNdockRaw, ApiSlotItemRaw } from "..";
import { ApiResponse } from "../common";
import { ApiKdockRaw } from "./k_dock";
import { ApiShipRaw } from "./ship";


export function isApiEnvelope(obj: unknown): obj is ApiResponse {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return 'api_result' in o && 'api_data' in o;
}

export function unwrapEnvelope<T>(obj: unknown): T | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  // 标准结构
  if ('api_data' in o && o.api_data !== undefined) {
    return o.api_data as T;
  }

  // 已经是解开的数据
  return obj as T;
}


/**
 * API 响应中可能包含的状态字段
 * 用于 State Extractor 自动检测和提取
 */
export interface ApiStateFields {
  // 提督信息
  api_basic?: ApiBasicRaw;

  // 资源
  api_material?: ApiMaterialItemRaw[];

  api_deck_port?: ApiDeckPortRaw[];
  api_deck_data?: ApiDeckPortRaw[];

  api_ship?: ApiShipRaw[];
  api_ship_data?: ApiShipRaw[];

  // 入渠/建造
  api_ndock?: ApiNdockRaw[];
  api_kdock?: ApiKdockRaw[];

  // 装备
  api_slot_item?: ApiSlotItemRaw[];
}

/**
 * 检测结果
 */
export interface StateFieldsDetection {
  hasAdmiral: boolean;
  hasMaterials: boolean;
  hasDecks: boolean;
  hasShips: boolean;
  hasNdock: boolean;
  hasKdock: boolean;
  hasSlotItem: boolean;
  /** 是否有任何状态字段 */
  any: boolean;
}

export function detectStateFields(data: unknown): StateFieldsDetection {
  const result: StateFieldsDetection = {
    hasAdmiral: false,
    hasMaterials: false,
    hasDecks: false,
    hasShips: false,
    hasNdock: false,
    hasKdock: false,
    hasSlotItem: false,
    any: false,
  };

  if (!data || typeof data !== 'object') return result;

  const obj = data as ApiStateFields;

  result.hasAdmiral = !!obj.api_basic;
  result.hasMaterials = Array.isArray(obj.api_material) && obj.api_material.length > 0;
  result.hasDecks = Array.isArray(obj.api_deck_port) || Array.isArray(obj.api_deck_data);
  result.hasShips = Array.isArray(obj.api_ship) || Array.isArray(obj.api_ship_data);
  result.hasNdock = Array.isArray(obj.api_ndock) && obj.api_ndock.length > 0;
  result.hasKdock = Array.isArray(obj.api_kdock) && obj.api_kdock.length > 0;
  result.hasSlotItem = Array.isArray(obj.api_slot_item) && obj.api_slot_item.length > 0;

  result.any = result.hasAdmiral || result.hasMaterials || result.hasDecks ||
  result.hasShips || result.hasNdock || result.hasKdock || result.hasSlotItem;

  return result;
}

/**
 * 提取状态字段（类型安全）
 */
export function extractStateFields(data: unknown): ApiStateFields | null {
  if (!data || typeof data !== 'object') return null;
  return data as ApiStateFields;
}
// ==================== 具体 API 响应类型 ====================

/**
 * Port API 响应 (api_port/port)
 * 包含最完整的状态数据
 */
export interface ApiPortResponse extends ApiStateFields {
  api_basic: ApiBasicRaw;
  api_material: ApiMaterialItemRaw[];
  api_deck_port: ApiDeckPortRaw[];
  api_ndock: ApiNdockRaw[];
  api_ship: ApiShipRaw[];

  api_log?: Array<{
    api_no: number;
    api_type: string;
    api_state: string | number;
    api_message: string;
  }>;
  api_combined_flag?: number;
  api_p_bgm_id?: number;
  api_parallel_quest_count?: number;
}

/**
 * Ship2 API 响应 (api_get_member/ship2)
 */
export interface ApiShip2Response extends ApiStateFields {
  api_ship_data: ApiShipRaw[];
  api_deck_data: ApiDeckPortRaw[];
}

/**
 * Ship3 API 响应 (api_get_member/ship3)
 */
export interface ApiShip3Response extends ApiStateFields {
  api_ship_data: ApiShipRaw[];
  api_deck_data: ApiDeckPortRaw[];
  api_slot_data?: Record<string, ApiSlotItemRaw[]>;
}

/**
 * Deck API 响应 (api_get_member/deck)
 */
export interface ApiDeckResponse extends ApiStateFields {
  api_deck_data: ApiDeckPortRaw[];
}

/**
 * Preset Deck 响应 (api_get_member/preset_deck)
 */
export interface ApiPresetDeckResponse {
  api_max_num: number;
  api_deck: Record<string, {
    api_preset_no: number;
    api_name: string;
    api_name_id: string;
    api_ship: number[];
  }>;
}

/**
 * Charge (补给) 响应
 */
export interface ApiChargeResponse extends ApiStateFields {
  api_ship: ApiShipRaw[];
  api_material: ApiMaterialItemRaw[];
  api_use_bou?: number;
}

/**
 * Ndock Start (入渠开始) 响应
 */
export interface ApiNdockStartResponse extends ApiStateFields {
  api_ship: ApiShipRaw[];
  api_ndock: ApiNdockRaw[];
  api_material: ApiMaterialItemRaw[];
}

/**
 * Battle Result 响应中的 ship 数据
 */
export interface ApiBattleResultResponse extends ApiStateFields {
  api_ship_id?: number[];
  api_get_ship?: {
    api_ship_id: number;
    api_ship_type: string;
    api_ship_name: string;
    api_ship_getmes: string;
  };
  api_win_rank?: string;
  api_get_exp?: number;
  api_member_exp?: number;
  api_get_ship_exp?: number[];
  api_get_exp_lvup?: number[][];
  api_mvp?: number;
  api_enemy_info?: {
    api_level: string;
    api_rank: string;
    api_deck_name: string;
  };
  // ... 其他字段
}

/**
 * Hensei Change (编成变更) 响应
 */
export interface ApiHenseiChangeResponse extends ApiStateFields {
  // 通常只返回成功状态，但有些实现会返回 deck_data
  api_deck_data?: ApiDeckPortRaw[];
}

/**
 * Supply (补给) 响应
 */
export interface ApiSupplyResponse extends ApiStateFields {
  api_ship: ApiShipRaw[];
  api_material: ApiMaterialItemRaw[];
}

/**
 * Powerup (近代化改修) 响应
 */
export interface ApiPowerupResponse extends ApiStateFields {
  api_powerup_flag: number;
  api_ship: ApiShipRaw[];
  api_deck?: ApiDeckPortRaw[];
}

/**
 * Remodel (改造) 响应
 */
export interface ApiRemodelResponse extends ApiStateFields {
  api_after_slot?: number[];
  api_use_slot?: number[];
}

// ==================== 类型守卫 ====================

/**
 * 检查是否是 Port 响应
 */
export function isPortResponse(data: unknown): data is ApiPortResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as ApiStateFields;
  return !!obj.api_basic && Array.isArray(obj.api_deck_port) && Array.isArray(obj.api_ship);
}

/**
 * 检查是否是 Ship2/Ship3 响应
 */
export function isShipDataResponse(data: unknown): data is ApiShip2Response {
  if (!data || typeof data !== 'object') return false;
  const obj = data as ApiStateFields;
  return Array.isArray(obj.api_ship_data);
}

/**
 * 检查是否是 Deck 响应
 */
export function isDeckResponse(data: unknown): data is ApiDeckResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as ApiStateFields;
  return Array.isArray(obj.api_deck_data) && !Array.isArray(obj.api_ship_data);
}

// ==================== 工具类型 ====================

/**
 * 从 API 响应中提取指定字段的类型
 */
export type ExtractApiField<T extends keyof ApiStateFields> = NonNullable<ApiStateFields[T]>;

/**
 * 获取舰队数据（兼容两种字段名）
 */
export function getDecksFromResponse(data: ApiStateFields): ApiDeckPortRaw[] | undefined {
  return data.api_deck_port ?? data.api_deck_data;
}

/**
 * 获取舰船数据（兼容两种字段名）
 */
export function getShipsFromResponse(data: ApiStateFields): ApiShipRaw[] | undefined {
  return data.api_ship ?? data.api_ship_data;
}