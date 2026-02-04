import { webview } from '@kit.ArkWeb';

export type WebCtrl = webview.WebviewController;

/* ===================== JSProxy（window.hmos.*） ===================== */

export interface HmosBridge {
  /** 同步上报： */
  post(msg: string): void;
  /** 异步上报 */
  postAsync(msg: string): Promise<string>;
}

/* ===================== Bridge 消息类型 ===================== */

export interface ApiDump {
  type: 'API_DUMP';
  url: string;
  requestBody: string;
  responseText: string;
}

/** FPS  */
export interface FpsEvent {
  type: 'FPS';
  value: number;
}

/** 夜战检测 */
export interface YasenUiEvent {
  type: 'YASEN_UI';
  ts: number;
  yesId: string;
  noId: string;
  containerName: string;
}

/** Ping 事件 */
export interface PingEvent {
  type: 'PING';
  ts: number;
}

/** 所有 Bridge 消息联合类型 */
export type BridgeMessage =
  | ApiDump
  | FpsEvent
  | YasenUiEvent
  | PingEvent;

/** @deprecated 使用 BridgeMessage */
export type AppChannelMessage = ApiDump | FpsEvent;

/* ===================== 消息解析 ===================== */

/**
 * 解析 Bridge 消息
 * @returns 解析后的消息，或 null（无法识别）
 */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return null;

    const type = obj.type;

    // FPS
    if (type === 'FPS' && typeof obj.value === 'number') {
      return { type: 'FPS', value: obj.value } as FpsEvent;
    }

    // YASEN_UI
    if (type === 'YASEN_UI') {
      return {
        type: 'YASEN_UI',
        ts: typeof obj.ts === 'number' ? obj.ts : Date.now(),
        yesId: typeof obj.yesId === 'string' ? obj.yesId : '',
        noId: typeof obj.noId === 'string' ? obj.noId : '',
        containerName: typeof obj.containerName === 'string' ? obj.containerName : '',
      } as YasenUiEvent;
    }

    // PING
    if (type === 'PING') {
      return {
        type: 'PING',
        ts: typeof obj.ts === 'number' ? obj.ts : Date.now(),
      } as PingEvent;
    }

    // API_DUMP (type 可能为空)
    if (typeof obj.url === 'string' && typeof obj.responseText === 'string') {
      return {
        type: 'API_DUMP',
        url: obj.url,
        requestBody: typeof obj.requestBody === 'string' ? obj.requestBody : String(obj.requestBody ?? ''),
        responseText: obj.responseText,
      } as ApiDump;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * @deprecated 使用 parseBridgeMessage
 */
export function parseAppChannelMessage(raw: string): AppChannelMessage | null {
  const msg = parseBridgeMessage(raw);
  if (msg && (msg.type === 'API_DUMP' || msg.type === 'FPS')) {
    return msg;
  }
  return null;
}

/* ===================== 类型守卫 ===================== */

export function isApiDump(msg: BridgeMessage): msg is ApiDump {
  return msg.type === 'API_DUMP';
}

export function isFpsEvent(msg: BridgeMessage): msg is FpsEvent {
  return msg.type === 'FPS';
}

export function isYasenUiEvent(msg: BridgeMessage): msg is YasenUiEvent {
  return msg.type === 'YASEN_UI';
}

export function isPingEvent(msg: BridgeMessage): msg is PingEvent {
  return msg.type === 'PING';
}

/* ===================== onInterceptRequest ===================== */

export interface WebResourceRequest {
  url: string;
  method: string;                         // 'GET' | 'POST' ...
  headers: Record<string, string>;
}

export interface WebResourceResponse {
  data: ArrayBuffer;
  mimeType: string;                       // 'application/javascript' | 'image/png' ...
  statusCode?: number;                    // 默认 200
  reasonPhrase?: string;                  // 默认 'OK'
  headers?: Record<string, string>;
}

export interface ApiPacket {
  ts: number;
  url: string;
  path: string;
  method: string;           // GET/POST...
  status: number;           // 200/403...
  reqBody: string;
  bodyText: string;
  bodyJSON: unknown;
}

/* ===================== 注入配置（Builder） ===================== */

export interface InjectOptions {
  /** JSProxy Name（window[channelName]） */
  channelName?: string;                   // 默认 'hmos'
  /** JSProxy Method（window[channelName][postMethod]） */
  postMethod?: string;                    // 默认 'post'
  /** apiFilter */
  apiFilter?: string;                     // 默认 '/kcsapi/'

  enableXHRHook?: boolean;                // 默认 true
  enableFetchHook?: boolean;              // 默认 true
  enableFPS?: boolean;                    // 默认 false
  enableTouchPatch?: boolean;             // 默认 false
  enableTickerRAF?: boolean;              // 默认 true
  enablePixiPatch?: boolean;              // 默认 false

  enableSessionPersist?: boolean;         // 默认 true
  enableIframeFit?: boolean;              // 默认 true
  enableYasenDetect?: boolean;
  enableDebug?: boolean;
}

export const defaultInjectOptions: Required<InjectOptions> = {
  channelName: 'hmos',
  postMethod: 'post',
  apiFilter: '/\\/kcsapi\\//',
  enableXHRHook: true,
  enableFetchHook: true,
  enableFPS: false,
  enableTouchPatch: false,
  enableTickerRAF: false,
  enablePixiPatch: false,
  enableSessionPersist: true,
  enableIframeFit: true,
  enableYasenDetect: false,
  enableDebug: true,
};
