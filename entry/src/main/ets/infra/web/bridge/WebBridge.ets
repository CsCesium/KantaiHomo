// entry/src/main/ets/infra/web/bridge/WebBridge.ets
import { webview } from '@kit.ArkWeb';

export interface BridgeHandlers {
  onMessagePayload: (payload: string) => void;
  onRpc: (raw: string) => Promise<string>;
}

interface PostMessageEnvelope {
  type: string;
  payload: string;
}

function parseEnvelope(raw: string): PostMessageEnvelope | null {
  try {
    const obj: Record<string, string> = JSON.parse(raw) as Record<string, string>;
    if (typeof obj.type === 'string' && typeof obj.payload === 'string') {
      return { type: obj.type, payload: obj.payload };
    }
    return null;
  } catch {
    // 可选捕获绑定，避免 any/unknown
    return null;
  }
}

interface HmosProxy {
  post(msg: string): void;
  postAsync(msg: string): Promise<string>;
}

class HmosProxyImpl implements HmosProxy {
  private readonly handlers: BridgeHandlers;

  constructor(handlers: BridgeHandlers) {
    this.handlers = handlers;
  }

  public post(msg: string): void {
    this.handlers.onMessagePayload(msg);
  }

  public async postAsync(msg: string): Promise<string> {
    return this.handlers.onRpc(msg);
  }
}

export class WebBridge {
  private readonly ctl: webview.WebviewController;
  private readonly h: BridgeHandlers;
  private static readonly CHANNEL_NAME: string = 'hmos';
  private static readonly POST: string = 'post';
  private static readonly POST_ASYNC: string = 'postAsync';
  private static readonly PM_TYPE: string = 'APP_CHANNEL';

  constructor(ctl: webview.WebviewController, handlers: BridgeHandlers) {
    this.ctl = ctl;
    this.h = handlers;
  }

  registerProxy(permissionJson?: string): void {
    const proxy: HmosProxy = new HmosProxyImpl(this.h);

    this.ctl.registerJavaScriptProxy(
      proxy,
      WebBridge.CHANNEL_NAME,
      [WebBridge.POST],
      [WebBridge.POST_ASYNC],
      permissionJson
    );
    //debug
    this.ctl.runJavaScript?.(
      "try{ console.log('[bridge] handshake from ArkTS'); if(typeof window.__hm_flush==='function'){ window.__hm_flush(); } }catch(e){ console.warn('[bridge] handshake failed', e); }"
    );
  }

  handleOnMessage(raw: string): void {
    const env: PostMessageEnvelope | null = parseEnvelope(raw);
    if (env !== null && env.type === WebBridge.PM_TYPE) {
      this.h.onMessagePayload(env.payload);
    }
  }
}
