import { webview } from "@kit.ArkWeb";
import { buildInjectionBundle } from './inject/index'
import { HmosBridge, WebCtrl, AppChannelMessage, defaultInjectOptions } from './types'
import { parseAppChannelMessage as parseMsg } from './types'
import { PERMISSION_JSON, HOME_URL, USER_AGENT } from './config';
import { kvDelete, kvGetString, kvSet } from "../store/kv";
import hilog from '@ohos.hilog'; //for debug
import { lengthToNumber } from "../utils/TransUtil";
import display from '@ohos.display';
import window from "@ohos.window";
import common from "@ohos.app.ability.common";
import { decideLayout, FitPolicy, HostMode } from "./responsive";
import ButtonColumn from "./components/ButtonColumn";
import GameWeb from "./components/GameWeb";

interface iPayload {
  op: string;
  key?: string;
  value?: string;
  def?: string;
}

@Component
export default struct WebHost {
  private controller: WebCtrl = new webview.WebviewController();
  private readonly HOME = HOME_URL;

  @State private progress: number = 0;
  @State private mode: HostMode = HostMode.COMPACT;
  @State private fit: FitPolicy = 'height';

  private currentOri: window.Orientation = window.Orientation.AUTO_ROTATION;

  private async setWindowOrientation(ori: window.Orientation) {
    if (this.currentOri === ori) return;
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      const win = await window.getLastWindow(ctx);
      await win.setPreferredOrientation(ori);
      this.currentOri = ori;
    } catch (e) {
      hilog.error(0x1234, 'Web', 'setPreferredOrientation failed: %{public}s', e);
    }
  }

  private applyOrientationByMode() {
    if (this.mode === HostMode.COMPACT) {
      this.setWindowOrientation(window.Orientation.AUTO_ROTATION_LANDSCAPE);
    } else {
      this.setWindowOrientation(window.Orientation.AUTO_ROTATION);
    }
  }

  private displayChangeCb: (id: number) => void = (id: number): void => {
    const js: string = 'window.kcFitReflow && window.kcFitReflow();';
    this.controller.runJavaScript?.(js);
  };

  private handleJsMessage(raw: string) {
    const msg: AppChannelMessage | null = parseMsg(raw);
    if (!msg) {
      console.warn('[JSProxy] invalid message:', raw.slice(0, 200));
      return;
    }
    switch (msg.type) {
      case 'FPS':
        // TODO: 可在状态栏展示或上报
        // console.info('[FPS]', msg.value);
        break;
      case 'API_DUMP':
      default:
      // TODO: 在这里把 {url, requestBody, responseText} 交给 parsers → DAO
      //注意DUMP类型
        console.info('[API_DUMP]', (msg.url || '').slice(0, 120));
        break;
    }
  }


  private async handleJsRequest(msg: string): Promise<string> {
    try {
      const payload = JSON.parse(msg) as iPayload;
      switch (payload.op) {
        case 'kv.get': {
          const v = await kvGetString(payload.key ?? '', payload.def ?? '');
          return JSON.stringify({ ok: true, value: v });
        }
        case 'kv.set': {
          // 统一存为 string；（网页侧可自己序列化 JSON）
          await kvSet(payload.key ?? '', String(payload.value ?? ''));
          return JSON.stringify({ ok: true });
        }
        case 'kv.delete': {
          await kvDelete(payload.key ?? '');
          return JSON.stringify({ ok: true });
        }
        default:
          return JSON.stringify({ ok: false, error: 'unsupported op' });
      }
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  }

  private registerJSProxy() {
    const bridgeObj: HmosBridge = {
      post: (msg: string): void => this.handleJsMessage(msg),
      postAsync: async (msg: string): Promise<string> => {
        return await this.handleJsRequest(msg);
      }
    };
    this.controller.registerJavaScriptProxy(bridgeObj, 'hmos', ['post'], ['postAsync'], PERMISSION_JSON);
  }
  private onWebAttached = () => {
    try {
      webview.WebviewController.setWebDebuggingAccess(true);
    } catch (e) {
      hilog.error(0x1234, 'Web', '%{public}s', `setWebDebuggingAccess failed: ${e}`);
    }
    ;
    this.registerJSProxy();
    if (USER_AGENT) {
      try {
        this.controller.setCustomUserAgent(USER_AGENT);
        console.info('[WebHost] UA set:', USER_AGENT);
      } catch (e) {
        console.warn('[WebHost] setCustomUserAgent failed', e);
      }
    }
  }

  private onBegin = () => { this.progress = 5; this.injectAll(this.controller); }
  private onProg  = (p: number) => { this.progress = p; }
  private onEnd   = () => {   this.progress = 100;
    this.injectAll(this.controller);
    this.applyOrientationByMode();
    this.applyFitLock();
    this.pushFitPolicy(this.controller, this.fit);
  }

  private pushFitPolicy(controller: WebCtrl, policy: FitPolicy) {
    const js =
      `window.kcFitSetPolicy && window.kcFitSetPolicy("${policy}");` +
        `window.kcFitReflow && window.kcFitReflow();` +
        `setTimeout(()=>{window.kcFitReflow && window.kcFitReflow();},60);`;
    controller.runJavaScript?.(js);
  }

  private applyFitLock() {
    const lock = this.mode === HostMode.COMPACT; // 小屏锁定“横屏画面”
    const js = `window.kcFitLock && window.kcFitLock(${lock ? 'true' : 'false'});`;
    this.controller.runJavaScript?.(js);
  }

  private injectAll(controller: WebCtrl) {
    const script = buildInjectionBundle(defaultInjectOptions);
    controller.runJavaScript?.(script);
  }
  private get showBottomTools(): boolean { return this.mode === HostMode.EXPANDED; }

  aboutToAppear() {
    try {
      const context = getContext(this) as common.UIAbilityContext;
      window.getLastWindow(context).then(win => {
        win.setWindowLayoutFullScreen(true);
        win.setWindowSystemBarEnable([]); // 隐藏状态栏
      });
    } catch (e) {
      hilog.error(0x1234, 'Web', 'FullScreen error: %{public}s', e);
    }
    try {
      webview.WebviewController.setWebDebuggingAccess(true);
      display.on('change', this.displayChangeCb);
    } catch (e) {
      hilog.error(0x1234, 'Web', '%{public}s', `aboutToAppear error: ${e}`);
    }

    this.setWindowOrientation(window.Orientation.LANDSCAPE);
  }

  build() {
    Column() {
      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress }).width('100%').height(2).backgroundColor('#222')
      }

      Row() {
        ButtonColumn({ onRefresh: () => this.controller.refresh() })
          .width(this.mode === HostMode.COMPACT ? 56 : 0)
          .visibility(this.mode === HostMode.COMPACT ? Visibility.Visible : Visibility.None)
          .padding({ left: 4, right: 4, top: 8, bottom: 8 })

        Stack() {
          GameWeb({
            src: this.HOME,
            controller: this.controller,
            onWebAttached: this.onWebAttached,
            onWebPageBegin: this.onBegin,
            onWebProgress: this.onProg,
            onWebPageEnd: this.onEnd
          })
        }
        .layoutWeight(1).height('100%')
      }
      .height('100%').width('100%').backgroundColor('#000')
      Row() {
        ButtonColumn({ onRefresh: () => this.controller.refresh() })
        Blank().layoutWeight(1)   //TODO:Reserved for future dashboard
      }
      .height(this.showBottomTools ? 96 : 0)
      .visibility(this.showBottomTools ? Visibility.Visible : Visibility.None)
      .width('100%')
      .backgroundColor('#0b0b0b')

    }
    .height('100%').width('100%').backgroundColor('#000')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
    .onAreaChange((_, area) => {
      const w = lengthToNumber(area.width);
      const h = lengthToNumber(area.height);
      const decision = decideLayout(w, h);
      this.mode = decision.mode;
      this.fit  = decision.policy;

      this.applyOrientationByMode();
      this.applyFitLock();
      this.pushFitPolicy(this.controller, this.fit);
    })
  }
  aboutToDisappear() {
    display.off('change', this.displayChangeCb);
  }
}