
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
    | 'taiha_warning';

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

export type AnyAlert =
  | ExpeditionReturnAlert
    | YasenPromptAlert
    | TaihaWarningAlert;

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
  enableNotification: false,
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
