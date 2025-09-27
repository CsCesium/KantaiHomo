import { webview } from '@kit.ArkWeb';
import display from '@ohos.display';
import common from '@ohos.app.ability.common';
import { WebBridge } from '../bridge/WebBridge';
import { FitAndDisplay } from '../layout/fit';
import { buildInjectionBundle } from '../../web/inject';
import { defaultInjectOptions, InjectOptions, AppChannelMessage, ApiDump } from '../types';
import { parseAppChannelMessage as parseMsg } from '../types';
import { ingestDump } from '../../../features/router/persist/ingest/webDump';
import { getPersistDeps } from '../../../dev/deps';
import { PERMISSION_JSON, USER_AGENT } from '../config';
import { Orientation } from '../layout/orientation';

export interface FitGetter {
  policy: string;
  locked: boolean;
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

export class WebHostController {
  private ctl: webview.WebviewController;
  private ctx: common.UIAbilityContext;
  private getFit: () => FitGetter;
  private getOpts: () => InjectOptions;
  private rpc: RpcHandler;
  private bridge: WebBridge;
  private layout: FitAndDisplay;
  private ori: Orientation;
  private boundDisplayCb: ((id: number) => void) | null = null;

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
    if (typeof rpcHandler === 'function') {
      this.rpc = new FunctionRpcHandler(rpcHandler as (raw: string) => Promise<string>);
    } else {
      this.rpc = rpcHandler as RpcHandler;
    }

    this.bridge = new WebBridge(this.ctl, {
      onMessagePayload: (payload: string): void => this.onHookPayload(payload),
      onRpc: (raw: string): Promise<string> => this.rpc.handle(raw),
    });
    this.layout = new FitAndDisplay(this.ctl);
    this.ori = new Orientation(this.ctx);
  }

  attach(): void {
    this.bridge.registerProxy(PERMISSION_JSON);
    if (USER_AGENT) {
      this.ctl.setCustomUserAgent(USER_AGENT);
    }
  }

  onPageBegin(): void {
    this.injectAll();
  }

  onPageEnd(): void {
    this.injectAll();
    const f: FitGetter = this.getFit();
    this.layout.resetFitCache();
    this.layout.applyFitLock(f.locked);
    this.layout.pushFitPolicy(f.policy);
  }

  bindDisplay(): void {
    const cb = (_id: number): void => {
      const f: FitGetter = this.getFit();
      this.layout.onDisplayChangeDebounced(f.policy, f.locked);
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
}