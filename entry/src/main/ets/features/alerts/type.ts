
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

export type AlertType =
  | 'expedition_return'
  | 'yasen_prompt'
  | 'taiha_warning'
  | 'sortie_next';

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
}

export type AnyAlert =
  | ExpeditionReturnAlert
  | YasenPromptAlert
  | TaihaWarningAlert
  | SortieNextAlert;

// ========== Alert Config ==========

export interface AlertConfig {
  enableToast: boolean;
  enableVibrate: boolean;
  enableNotification: boolean;
  vibrateDurationMs: number;
  debounceMs: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enableToast: true,
  enableVibrate: true,
  enableNotification: true,
  vibrateDurationMs: 150,
  debounceMs: 1200,
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
