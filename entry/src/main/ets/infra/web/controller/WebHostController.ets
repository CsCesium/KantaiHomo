import { webview } from '@kit.ArkWeb';
import display from '@ohos.display';
import common from '@ohos.app.ability.common';
import { WebBridge } from '../bridge/WebBridge';
import { FitAndDisplay } from '../layout/fit';
import { buildInjectionBundle } from '../../web/inject';
import { defaultInjectOptions, InjectOptions, AppChannelMessage, ApiDump } from '../types';
import { parseAppChannelMessage as parseMsg } from '../types';
import { ingestDump } from '../../../features/router/persist/ingest/webDump';
import { getPersistDeps } from '../../deps/index';
import { PERMISSION_JSON, USER_AGENT } from '../config';
import { Orientation } from '../layout/orientation';
import hilog from '@ohos.hilog';

const HILOG_DOM: number = 0x1357;

export interface FitGetter {
  policy: string;
  locked: boolean;
  viewportW: number;
  viewportH: number;
}
export interface RpcHandler {
  handle(raw: string): Promise<string>;
}
interface ApiDumpFields {
  url?: string;
  requestBody?: string;
  responseText?: string;
}

function asApiDump(m: AppChannelMessage): ApiDump | null {
  const x = m as ApiDump;
  const f = x as ApiDumpFields;
  if (typeof f.url === 'string' &&
    typeof f.requestBody === 'string' &&
    typeof f.responseText === 'string') {
    return x;
  }
  return null;
}

export class FunctionRpcHandler implements RpcHandler {
  private fn: (raw: string) => Promise<string>;
  constructor(fn: (raw: string) => Promise<string>) { this.fn = fn; }
  handle(raw: string): Promise<string> { return this.fn(raw); }
}

enum ProxyStage {
  INIT = 0,
  AFTER_ATTACH = 1,
  STABLE = 2
}

export class WebHostController {
  private ctl: webview.WebviewController;
  private ctx: common.UIAbilityContext;
  private getOpts: () => InjectOptions;
  private rpc: RpcHandler;
  private bridge: WebBridge;
  private layout: FitAndDisplay;
  private ori: Orientation;
  private boundDisplayCb: ((id: number) => void) | null = null;
  private getFit: () => FitGetter;
  private proxyStage: ProxyStage = ProxyStage.INIT;

  constructor(
    ctl: webview.WebviewController,
    ctx: common.UIAbilityContext,
    getFit: () => FitGetter,
    getInjectOptions: () => InjectOptions,
    rpcHandler: RpcHandler | ((raw: string) => Promise<string>)
  ) {
    this.ctl = ctl;
    this.ctx = ctx;
    this.getFit = getFit;
    this.getOpts = getInjectOptions;
    this.rpc = (typeof rpcHandler === 'function')
      ? new FunctionRpcHandler(rpcHandler as (raw: string) => Promise<string>)
      : (rpcHandler as RpcHandler);

    this.bridge = new WebBridge(this.ctl, {
      onMessagePayload: (payload: string): void => this.onHookPayload(payload),
      onRpc: (raw: string): Promise<string> => this.rpc.handle(raw),
    });
    this.layout = new FitAndDisplay(this.ctl);
    this.ori = new Orientation(this.ctx);
  }

  private extractTraceId(raw: string): string {
    const re = /"trace"\s*:\s*"([^"]+)"/;
    const m = re.exec(raw);
    return m ? m[1] : '';
  }

  attach(): void {

    this.bridge.registerProxy(PERMISSION_JSON);
    hilog.info(HILOG_DOM, 'Bridge', 'registerProxy@attach');

    if (USER_AGENT) {
      this.ctl.setCustomUserAgent(USER_AGENT);
    }

    if (this.proxyStage === ProxyStage.INIT) {
      this.proxyStage = ProxyStage.AFTER_ATTACH;
      this.ctl.runJavaScript?.("try{ console.log('[proxy] refresh after attach'); }catch(e){}");
      this.ctl.refresh();
      return;
    }

    this.ctl.runJavaScript?.(
      "try{ console.log('[bridge] handshake from ArkTS'); if(typeof window.__hm_flush==='function'){ window.__hm_flush(); } }catch(e){}"
    );

    const f0: FitGetter = this.getFit();
    this.pushFitStrong(f0.policy, f0.locked, f0.viewportW, f0.viewportH);
  }

  onPageBegin(): void {
    this.injectAll();
  }

  onPageEnd(): void {
    if (this.proxyStage === ProxyStage.AFTER_ATTACH) {
      this.bridge.registerProxy(PERMISSION_JSON);
      hilog.info(HILOG_DOM, 'Bridge', 'registerProxy@onPageEnd');
      this.proxyStage = ProxyStage.STABLE;
      this.ctl.runJavaScript?.("try{ console.log('[proxy] refresh after navigation'); }catch(e){}");
      this.ctl.refresh();
      return;
    }

    this.injectAll();

    const f: FitGetter = this.getFit();
    this.layout.resetFitCache();
    this.pushFitStrong(f.policy, f.locked, f.viewportW, f.viewportH);

    this.ctl.runJavaScript?.("try{ if(typeof window.__hm_flush==='function'){ window.__hm_flush(); } }catch(e){}");
    this.ctl.runJavaScript?.(
      "try{ console.log('[diag] origin=', location.origin, 'hmos=', typeof window.hmos," +
        "' post=', (window.hmos&&typeof window.hmos.post)," +
        "' postAsync=', (window.hmos&&typeof window.hmos.postAsync)); }catch(e){}"
    );
  }

  bindDisplay(): void {
    const cb = (_id: number): void => {
      const f: FitGetter = this.getFit();
      this.layout.onDisplayChangeDebounced(f.policy, f.locked);
      this.pushFitStrong(f.policy, f.locked, f.viewportW, f.viewportH);
    };
    display.on('change', cb);
    this.boundDisplayCb = cb;
  }

  unbindDisplay(): void {
    if (this.boundDisplayCb !== null) {
      display.off('change', this.boundDisplayCb);
      this.boundDisplayCb = null;
    }
  }

  async applyOrientationByMode(isCompact: boolean): Promise<void> {
    await this.ori.applyByMode(isCompact);
  }

  onPostMessage(raw: string): void {
    this.bridge.handleOnMessage(raw);
  }

  private injectAll(): void {
    const script: string = buildInjectionBundle(this.getOpts());
    if (typeof this.ctl.runJavaScript === 'function') {
      //this.ctl.runJavaScript(script);
    }
  }

  private onHookPayload(raw: string): void {
    const traceId: string = this.extractTraceId(raw);
    hilog.info(HILOG_DOM, 'Bridge', '[RX] trace=%{public}s bytes=%{public}d', traceId, raw.length);

    if (traceId.length > 0) {
      const jsAck: string =
        "try{ if(typeof window.__hm_ack==='function'){ window.__hm_ack(" + JSON.stringify(traceId) + "); } }catch(e){}";
      this.ctl.runJavaScript?.(jsAck);
    }

    const msg: AppChannelMessage | null = parseMsg(raw);
    if (msg === null) { return; }

    const deps = getPersistDeps();
    if (deps !== null) {
      const dump: ApiDump | null = asApiDump(msg);
      if (dump !== null) {
        void ingestDump(dump, deps);
      }
    }


  }

  private pushFitStrong(policy: string, locked: boolean, vw: number, vh: number): void {
    const js: string =
      "try{"
        + "console.log('[fit] pushStrong', " + JSON.stringify(policy) + "," + (locked ? "true" : "false") + ", 'vw/vh='," + vw + "," + vh + ");"
        + "if (typeof window.kcFitSetViewport==='function'){ window.kcFitSetViewport(" + vw + "," + vh + "); }"
        + "else { window.__kc_host_viewport={w:" + vw + ",h:" + vh + "}; }"
        + "if (window.kcFitSetPolicy) window.kcFitSetPolicy(" + JSON.stringify(policy) + ");"
        + "if (window.kcFitLock)      window.kcFitLock(" + (locked ? "true" : "false") + ");"
        + "if (window.kcFitReflow)    window.kcFitReflow();"
        + "if (window.requestAnimationFrame){ requestAnimationFrame(function(){ try{ if (window.kcFitReflow) window.kcFitReflow(); }catch(e){} }); }"
        + "setTimeout(function(){ try{ if (window.kcFitReflow) window.kcFitReflow(); }catch(e){} }, 200);"
        + "}catch(e){ console.warn('[fit] pushStrong error', e); }";
    this.ctl.runJavaScript?.(js);
  }
}
