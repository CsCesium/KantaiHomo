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

  @State private btnAlign: Alignment = Alignment.Start;
  @State private btnOffsetX: number = 16;
  @State private btnOffsetY: number = 0;

  private win: window.Window | null = null;

  private displayChangeCb: (id: number) => void = (id: number): void => {
    const js: string = 'window.kcFitReflow && window.kcFitReflow();';
    this.controller.runJavaScript?.(js);
  };


  // private enableFullScreen(): void {
  //   try {
  //     const ui = getContext(this).getUIContext();
  //     this.win = ui.getWindow();
  //     if (this.win !== null) {
  //       this.win.setWindowLayoutFullScreen(true);
  //     }
  //   } catch (e) {
  //     hilog.error(0x1234, 'Web', '%{public}s', `enableFullScreen error: ${e}`);
  //   }
  // }

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

  private decidePolicy(area: Area): string {
    const w: number = lengthToNumber(area.width);
    const h: number = lengthToNumber(area.height);

    const shortSide: number = (w < h) ? w : h;
    const longSide: number = (w > h) ? w : h;

    const SMALL_THRESHOLD: number = 680; // 悬浮窗判定
    const EXPANDED_THRESHOLD: number = 1100; // 折叠展开判定

    if (shortSide <= SMALL_THRESHOLD) {
      return 'height'; // 小窗：纵向占满
    }
    if (longSide >= EXPANDED_THRESHOLD) {
      return 'width'; // 折叠展开：横向占满
    }
    // 横屏→height，竖屏→width
    return (w >= h) ? 'height' : 'width';
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

  private injectAll(controller: WebCtrl) {
    const script = buildInjectionBundle(defaultInjectOptions);
    controller.runJavaScript?.(script);
  }

  aboutToAppear() {
    try {
      webview.WebviewController.setWebDebuggingAccess(true);
      display.on('change', this.displayChangeCb);
    } catch (e) {
      hilog.error(0x1234, 'Web', '%{public}s', `aboutToAppear error: ${e}`);
    }
  }

  @Builder
  ctrlBtn(label: string, onTap: () => void) {
    Button({ type: ButtonType.Circle, stateEffect: true }) {
      Text(label).fontSize(16).fontWeight(FontWeight.Medium)
    }
    .width(44)
    .height(44)
    .backgroundColor('#2979FF')
    .shadow({
      radius: 8,
      color: '#66000000',
      offsetX: 0,
      offsetY: 2
    })
    .onClick(onTap)
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress }).width('100%').height(2).backgroundColor('#222')
      }

      Web({ src: this.HOME, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .onControllerAttached(() => {
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
        })
        .onLoadIntercept(() => false)
        .onInterceptRequest((event)=> {
          return undefined;
        })
        .onPageBegin(() => {
          this.progress = 5
          // 提前注入一份（GUARDS 会防止重复执行）
          this.injectAll(this.controller);
        })
        .onProgressChange(e => {
          this.progress = e?.newProgress ?? 0;
        })
        .onPageEnd(() => {
          this.progress = 100;
          this.injectAll(this.controller);
        })
        .width('100%')
        .height('100%')
        .backgroundColor('#000')

      Column({ space: 10 }) {
        this.ctrlBtn('⟳', () => { this.controller.refresh(); })
      }
      .align(this.btnAlign)                      // 动态对齐
      .offset({ x: this.btnOffsetX, y: this.btnOffsetY })
      .zIndex(1001)
    }


    .height('100%').width('100%').backgroundColor('#000')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
    .onAreaChange((oldArea: Area, newArea: Area) => {
      const p: string = this.decidePolicy(newArea); // 'height' (横屏) | 'width' (竖屏)
      const js =
        'window.kcFitSetPolicy && window.kcFitSetPolicy("' + p + '");' +
          'window.kcFitReflow && window.kcFitReflow();' +
          'setTimeout(function(){window.kcFitReflow && window.kcFitReflow();}, 60);';
      this.controller.runJavaScript?.(js);

      if (p === 'height') { // 横屏
        this.btnAlign = Alignment.Start;
        this.btnOffsetX = 16; this.btnOffsetY = 0;
      } else {              // 竖屏
        this.btnAlign = Alignment.BottomStart;
        this.btnOffsetX = 0;  this.btnOffsetY = 16;
      }
    })
  }
  aboutToDisappear() {
    display.off('change', this.displayChangeCb);
  }
}