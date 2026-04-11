
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
  | 'battle_result';

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

/** 出击下一节点提醒 */
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
}

/** 战斗结算提醒 */
export interface BattleResultAlert extends BaseAlert {
  type: 'battle_result';
  rank: string;
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  isBoss: boolean;
  /** 节点事件描述 (例如: "战斗") */
  eventDesc: string;
  /** 敌方舰队名称 (api_deck_name) */
  enemyDeckName: string;
  /** 出击舰队 ID */
  deckId: number;
  /** 联合舰队类型 */
  combinedType: number;
  dropShipName?: string;
}

export type AnyAlert =
  | ExpeditionReturnAlert
  | YasenPromptAlert
  | TaihaWarningAlert
  | SortieNextAlert
  | BattleResultAlert;

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
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enableToast: true,
  enableVibrate: true,
  enableNotification: true,
  vibrateDurationMs: 150,
  debounceMs: 1200,
  enableYasenAlert: true,
  enableBattleResultAlert: true,
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
