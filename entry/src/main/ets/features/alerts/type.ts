
// ========== Basic Tool ==========

import type { MapResourceGain } from '../../domain/models/struct/map';

export interface Cancelable {
  cancel(): void;
}

export type TimeoutId = number;

export interface Clock {
  now(): number;
  setTimeout(cb: () => void, ms: number): Cancelable;
  clearTimeout(handle: Cancelable): void;
}

// ========== Alert Type ==========

export type AlertMode = 'vibrate' | 'ring' | 'both';

export type AlertType =
  | 'expedition_return'
  | 'yasen_prompt'
  | 'taiha_warning'
  | 'sortie_start_taiha'
  | 'sortie_next'
  | 'battle_result'
  | 'fleet_status'
  | 'sortie_advance'
  | 'repair_complete'
  | 'dev_result'
  | 'build_start'
  | 'build_result'
  | 'remodel_result';

export interface BaseAlert {
  type: AlertType;
  timestamp: number;
}

/** 远征返回提醒 */
export interface ExpeditionReturnAlert extends BaseAlert {
  type: 'expedition_return';
  deckId: number;
  missionId: number;
}

/** 夜战选择提醒 */
export interface YasenPromptAlert extends BaseAlert {
  type: 'yasen_prompt';
  yesTex: string;
  noTex: string;
  containerName: string;
}

/** 大破警告 */
export interface TaihaWarningAlert extends BaseAlert {
  type: 'taiha_warning';
  shipUids: number[];
  shipNames?: string[];
}

/** 出击瞬间检测到的大破舰 — 基于 GameState 的双保险（弹窗 + 振动） */
export interface SortieStartTaihaAlert extends BaseAlert {
  type: 'sortie_start_taiha';
  deckId: number;
  /** 大破且无损管/女神的舰娘列表（已排除主队旗舰，已排除已沉没/0 HP） */
  ships: { uid: number; name: string; hpNow: number; hpMax: number }[];
}

/** 出击下一节点提醒（api_req_map/next 触发，适用于所有节点类型） */
export interface SortieNextAlert extends BaseAlert {
  type: 'sortie_next';
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  eventId: number;
  eventKind: number;
  isBoss: boolean;
  /** 事件描述 (例如: "战斗", "资源", "漩涡" 等) */
  eventDesc: string;
  /** 出击舰队 ID */
  deckId: number;
  /** 联合舰队类型 0=无 1=机动 2=水上 3=输送 */
  combinedType: number;
  /** 舰队名称 */
  fleetName: string;
  /** 是否存在大破无损管击沉风险（来自上一场战斗结算） */
  hasTaihaRisk: boolean;
  /** 敌方旗舰名称（来自 /next api_e_deck_info，仅战斗节点且数据存在时） */
  enemyFlagshipName?: string;
  /** 资源点获得的资源信息（来自 /next api_itemget） */
  resourceGains?: MapResourceGain[];
}

/** 战斗结算提醒 */
export interface BattleResultAlert extends BaseAlert {
  type: 'battle_result';
  cellId: number;
  isBoss: boolean;
  rank: string;
  /** 是否存在大破且无损管的击沉风险 */
  hasTaihaRisk: boolean;
}

/** 入渠修理完成提醒 */
export interface RepairCompleteAlert extends BaseAlert {
  type: 'repair_complete';
  dockId: number;
  shipUid: number;
}

/** 进击选择提醒（进击/撤退按钮出现时触发） */
export interface SortieAdvanceAlert extends BaseAlert {
  type: 'sortie_advance';
  /** 是否存在大破无损管击沉风险 */
  hasTaihaRisk: boolean;
}

/** 舰队状态提醒（由 api_get_member/mapinfo 触发） */
export interface FleetStatusAlert extends BaseAlert {
  type: 'fleet_status';
  /** 有未补给舰船的舰队 ID 列表 */
  unsuppliedDecks: number[];
  /** 未出击远征的舰队 ID 列表（第 2-4 舰队） */
  idleDecks: number[];
  /** 第 1 舰队中 cond < 30 的舰船 UID 列表 */
  fleet1LowCondShipUids: number[];
}

/** 装备开发结果提示（/api_req_kousyou/createitem） */
export interface DevResultAlert extends BaseAlert {
  type: 'dev_result';
  /** 各槽产出名称，失败槽为「失败」占位 */
  itemNames: string[];
  /** 失败槽数量 */
  failCount: number;
}

/** 建造开始提示（createship 后由 kdock 更新补全舰娘名） */
export interface BuildStartAlert extends BaseAlert {
  type: 'build_start';
  shipName: string;
  kdockId: number;
  /** 是否大型建造 */
  isLarge: boolean;
}

/** 建造完成领取提示（/api_req_kousyou/getship） */
export interface BuildResultAlert extends BaseAlert {
  type: 'build_result';
  shipName: string;
  kdockId: number;
}

/** 改修结果提示（/api_req_kousyou/remodel_slot） */
export interface RemodelResultAlert extends BaseAlert {
  type: 'remodel_result';
  success: boolean;
  itemName: string;
  /** 改修后的 ★ 等级（未知为 -1） */
  level: number;
}

export type AnyAlert =
  | ExpeditionReturnAlert
  | YasenPromptAlert
  | TaihaWarningAlert
  | SortieStartTaihaAlert
  | SortieNextAlert
  | BattleResultAlert
  | SortieAdvanceAlert
  | RepairCompleteAlert
  | FleetStatusAlert
  | DevResultAlert
  | BuildStartAlert
  | BuildResultAlert
  | RemodelResultAlert;

// ========== Alert Config ==========

export interface AlertConfig {
  enableToast: boolean;
  enableVibrate: boolean;
  enableNotification: boolean;
  vibrateDurationMs: number;
  debounceMs: number;
  /** 是否启用夜战选择提醒 (yasen_prompt) */
  enableYasenAlert: boolean;
  /** 是否启用战斗结算提醒 (battle_result) */
  enableBattleResultAlert: boolean;
  /** 是否启用入渠修理完成提醒 (repair_complete) */
  enableRepairAlert: boolean;
  /** 是否启用进击选择提醒 (sortie_advance) */
  enableAdvanceAlert: boolean;
  /** 是否启用开发结果 Toast (dev_result) */
  enableDevResultToast: boolean;
  /** 是否启用建造结果 Toast (build_result) */
  enableBuildResultToast: boolean;
  /** 是否启用改修结果 Toast (remodel_result) */
  enableRemodelResultToast: boolean;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enableToast: true,
  enableVibrate: true,
  enableNotification: true,
  vibrateDurationMs: 150,
  debounceMs: 1200,
  enableYasenAlert: true,
  enableBattleResultAlert: true,
  enableRepairAlert: true,
  enableAdvanceAlert: true,
  enableDevResultToast: true,
  enableBuildResultToast: true,
  enableRemodelResultToast: true,
};

// ========== Expedition DAO interface ==========

export interface ExpeditionNext {
  deckId: number;
  missionId: number;
  returnTime: number;
}

export interface ExpeditionDaoLike {
  getNextAfter(nowMs: number): Promise<ExpeditionNext | null>;
}

// ========== Repair DAO interface ==========

export interface RepairNext {
  dockId: number;
  shipUid: number;
  completeTime: number;
}

export interface RepairDaoLike {
  getNextAfter(nowMs: number): Promise<RepairNext | null>;
}
