
// ========== Basic Tool ==========

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
  | 'sortie_next'
  | 'battle_result'
  | 'fleet_status'
  | 'sortie_advance'
  | 'repair_complete';

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
  /** 敌方旗舰名称（来自 /next api_enemy_info，仅战斗节点且数据存在时） */
  enemyFlagshipName?: string;
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
}

export type AnyAlert =
  | ExpeditionReturnAlert
  | YasenPromptAlert
  | TaihaWarningAlert
  | SortieNextAlert
  | BattleResultAlert
  | SortieAdvanceAlert
  | RepairCompleteAlert
  | FleetStatusAlert;

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
