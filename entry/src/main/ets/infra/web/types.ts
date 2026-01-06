import { webview } from '@kit.ArkWeb';

export type WebCtrl = webview.WebviewController;

/* ===================== JSProxy（window.hmos.*） ===================== */

export interface HmosBridge {
  /** 同步上报： */
  post(msg: string): void;
  /** 异步上报 */
  postAsync(msg: string): Promise<string>;
}

export type BridgeMsg =
  | { type: 'YASEN_UI'; ts: number; yesId: string; noId: string; containerName: string }
    | { type: 'PING' ; ts: number }
    | { type: string; [k: string]: unknown };

export interface ApiDump {
  type?: 'API_DUMP';
  url: string;
  requestBody: string;
  responseText: string;
}

export interface FpsEvent {
  type: 'FPS';
  value: number;
}

export type AppChannelMessage = ApiDump | FpsEvent;

export function parseAppChannelMessage(raw: string): AppChannelMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      if (obj.type === 'FPS' && typeof obj.value === 'number') return obj as FpsEvent;
      if (typeof obj.url === 'string' && typeof obj.responseText === 'string') {
        if (typeof obj.requestBody !== 'string') obj.requestBody = String(obj.requestBody ?? '');
        if (!obj.type) obj.type = 'API_DUMP';
        return obj as ApiDump;
      }
    }
  } catch {}
  return null;
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
  bodyJSON: any;
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

  enableSessionPersist?: boolean; // 默认 true
  enableIframeFit?: boolean;      // 默认 true
  enableYasenDetect?:boolean;
  enableDebug?:boolean;
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
  enableYasenDetect:false,
  enableDebug:true,
};
