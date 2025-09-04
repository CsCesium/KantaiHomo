import {webview} from "@kit.ArkWeb";
import {buildInjectionBundle} from './inject/index'
import {HmosBridge, WebCtrl, AppChannelMessage, defaultInjectOptions} from './types'
import {parseAppChannelMessage as parseMsg}from './types'
import { PERMISSION_JSON, HOME_URL, USER_AGENT } from './config';

@Component
export default struct WebHost{
  private controller: WebCtrl = new webview.WebviewController();
  private readonly HOME = HOME_URL;
  @State private progress: number = 0;

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
        console.info('[API_DUMP]', (msg.url || '').slice(0, 120));
        break;
    }
  }

  private registerJSProxy() {
    const bridgeObj: HmosBridge = {
      post: (msg: string): void => this.handleJsMessage(msg),
      postAsync: async (msg: string): Promise<string> => { this.handleJsMessage(msg); return 'OK'; }
    };
    this.controller.registerJavaScriptProxy(bridgeObj, 'hmos', ['post'], ['postAsync'], PERMISSION_JSON);
  }

  private injectAll(controller:WebCtrl){
    const script = buildInjectionBundle(defaultInjectOptions);
    controller.runJavaScript?.(script);
  }

  build() {
    Column() {
      Row({ space: 8 }) {
        Button('←').onClick(() => this.controller.accessBackward() && this.controller.backward());
        Button('→').onClick(() => this.controller.accessForward() && this.controller.forward());
        Button('⟳').onClick(() => this.controller.refresh());
        Text('Web Shell').fontSize(16).fontWeight(FontWeight.Bold).margin({ left: 8 })
      }.padding(12).backgroundColor('#121212').width('100%')

      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress })
          .width('100%')
          .height(2)
          .backgroundColor('#222')
          .margin({ bottom: 2 })
      }

      Web({ src: this.HOME, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .onControllerAttached(() => {
          try {
            webview.WebviewController.setWebDebuggingAccess(true);
          } catch {
          };
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
        .onInterceptRequest((event): WebResourceResponse | undefined => {
          return undefined;
        })
        .onPageBegin(() => {
          this.progress = 5
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
    }
    .height('100%').width('100%').backgroundColor('#000')
  }
}