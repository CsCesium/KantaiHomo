import { PayloadEvent } from ".";

export interface YasenDetectedPayload {
  /** 夜战突入按钮纹理 ID */
  yesTex: string;
  /** 追撃せず按钮纹理 ID */
  noTex: string;
  /** 容器名称 (debug) */
  containerName: string;
  /** 检测时间戳 */
  detectedAt: number;
}

export type YasenDetectedEvent = PayloadEvent<'YASEN_DETECTED', YasenDetectedPayload>;

// ========== 大破警告事件 ==========

export interface TaihaWarningPayload {
  /** 大破舰娘 UID 列表 */
  shipUids: number[];
  /** 舰娘名称列表 (可选) */
  shipNames?: string[];
  /** 检测时间戳 */
  detectedAt: number;
}

export type TaihaWarningEvent = PayloadEvent<'TAIHA_WARNING', TaihaWarningPayload>;

// ========== 联合类型 ==========

export type AnyUiEvent =
  | YasenDetectedEvent
    | TaihaWarningEvent;