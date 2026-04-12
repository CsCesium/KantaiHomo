import { webview } from '@kit.ArkWeb';
import display from '@ohos.display';
import common from '@ohos.app.ability.common';
import { WebBridge } from '../bridge/WebBridge';
import { FitAndDisplay } from '../layout/fit';
import { buildInjectionBundle } from '../../web/inject';
import {  InjectOptions, AppChannelMessage, ApiDump,
  isApiDump,
  isYasenUiEvent,
  isSortieAdvanceUiEvent,
  parseBridgeMessage,
  YasenUiEvent,
  SortieAdvanceUiEvent } from '../types';
import { parseAppChannelMessage as parseMsg } from '../types';
import { ingestDump } from '../../../features/router/persist/ingest/webDump';
import { getPersistDeps } from '../../deps/index';
import { PERMISSION_JSON, USER_AGENT } from '../config';
import { Orientation } from '../layout/orientation';
import hilog from '@ohos.hilog';
import { YasenPromptAlert, SortieAdvancePromptAlert, publishAlert } from '../../../features/alerts';
import { getLastBattleHasTaihaRisk } from '../../../features/alerts/lastBattleState';

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

  private persistQ: ApiDump[] = [];
  private persistDraining: boolean = false;
  private readonly MAX_PERSIST_Q: number = 60;

  private ackQ: string[] = [];
  private ackDraining: boolean = false;
  private readonly MAX_ACK_Q: number = 200;
  private readonly ACK_BATCH: number = 30;


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
      this.ctl.runJavaScript(script);
    }
  }

  private onHookPayload(raw: string): void {
    const msg = parseBridgeMessage(raw);
    if (!msg) {
      hilog.warn(HILOG_DOM, 'Bridge', '[RX] unrecognized message');
      return;
    }

    // 处理夜战
    if (isYasenUiEvent(msg)) {
      this.handleYasenMessage(msg);
      return;
    }

    // 处理进击/撤退选择
    if (isSortieAdvanceUiEvent(msg)) {
      this.handleAdvanceMessage(msg);
      return;
    }

    // 处理 API Dump
    if (isApiDump(msg)) {
      const traceId = this.extractTraceId(raw);
      hilog.info(HILOG_DOM, 'Bridge', '[RX] trace=%{public}s bytes=%{public}d', traceId, raw.length);

      if (traceId.length > 0) {
        this.enqueueAck(traceId);
      }

      this.enqueuePersist(msg);
    }

    // FPS/PING 等其他消息暂不处理
  }

  private handleYasenMessage(msg: YasenUiEvent): void {
    hilog.info(HILOG_DOM, 'Bridge', '[YASEN] detected: yes=%{public}s no=%{public}s', msg.yesId, msg.noId);

    const alert: YasenPromptAlert = {
      type: 'yasen_prompt',
      timestamp: msg.ts,
      yesTex: msg.yesId,
      noTex: msg.noId,
      containerName: msg.containerName,
    };

    publishAlert(alert);
  }

  private handleAdvanceMessage(msg: SortieAdvanceUiEvent): void {
    hilog.info(HILOG_DOM, 'Bridge', '[ADVANCE] detected: adv=%{public}s ret=%{public}s', msg.advId, msg.retId);

    const alert: SortieAdvancePromptAlert = {
      type: 'sortie_advance_prompt',
      timestamp: msg.ts,
      hasTaihaRisk: getLastBattleHasTaihaRisk(),
    };

    publishAlert(alert);
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

  private enqueuePersist(dump: ApiDump): void {
    if (this.persistQ.length >= this.MAX_PERSIST_Q) {
      this.persistQ.shift();
      hilog.warn(HILOG_DOM, 'Bridge', '[persist] queue overflow, drop oldest');
    }
    this.persistQ.push(dump);

    if (!this.persistDraining) {
      this.persistDraining = true;
      setTimeout(() => { void this.drainPersistQueue(); }, 0);
    }
  }

  private async drainPersistQueue(): Promise<void> {
    try {
      while (this.persistQ.length > 0) {
        const dump = this.persistQ.shift()!;

        try {
          const deps = getPersistDeps();
          if (deps === null) continue;

          await ingestDump(dump, deps);
        } catch (e) {
          hilog.error(HILOG_DOM, 'Bridge', '[persist] ingest failed: %{public}s', String(e));
        }
      }
    } finally {
      this.persistDraining = false;
      if (this.persistQ.length > 0) {
        this.persistDraining = true;
        setTimeout(() => { void this.drainPersistQueue(); }, 0);
      }
    }
  }

  private enqueueAck(traceId: string): void {
    if (this.ackQ.length >= this.MAX_ACK_Q) {
      this.ackQ.shift()
      hilog.warn(HILOG_DOM, 'Bridge', '[ack] queue overflow, drop oldest')
    }
    this.ackQ.push(traceId)

    if (!this.ackDraining) {
      this.ackDraining = true
      setTimeout(() => { this.drainAckQueue() }, 0)
    }
  }

  private drainAckQueue(): void {
    try {
      if (!this.ackQ.length) return

      const batch: string[] = []
      while (batch.length < this.ACK_BATCH && this.ackQ.length > 0) {
        batch.push(this.ackQ.shift()!)
      }

      // 一次 runJavaScript 批量 ack，避免高频 Promise/回调
      const js: string =
        "try{"
          + "var a=" + JSON.stringify(batch) + ";"
          + "for(var i=0;i<a.length;i++){"
          + "  if(typeof window.__hm_ack==='function'){ window.__hm_ack(a[i]); }"
          + "}"
          + "}catch(e){}"

      this.ctl.runJavaScript?.(js)
    } finally {
      this.ackDraining = false
      if (this.ackQ.length > 0) {
        this.ackDraining = true
        setTimeout(() => { this.drainAckQueue() }, 0)
      }
    }
  }
}
