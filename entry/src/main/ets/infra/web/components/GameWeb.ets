import { webview } from "@kit.ArkWeb";
import { HOME_URL } from "../config";
import { createEmptyResp, shouldBlock } from "../interceptors/Interceptor";

interface messages {
  message?: string;
}

@ComponentV2
export default struct GameWeb {
  @Param src: string = HOME_URL;
  @Param controller: webview.WebviewController = new webview.WebviewController();
  @Event onWebAttached?: () => void;
  @Event onWebPageBegin?: () => void;
  @Event onWebProgress?: (p: number) => void;
  @Event onWebPageEnd?: () => void;

  build() {
    Web({ src: this.src, controller: this.controller })
      .javaScriptAccess(true)
      .domStorageAccess(true)
      .fileAccess(true)
      .onControllerAttached(() => { this.onWebAttached?.(); })
      .onLoadIntercept(() => false)
      .onInterceptRequest((ev) => {
        const url:string = ev&&ev.request? (ev.request.getRequestUrl()||''):'';
        if(!url) return undefined;
        if(!shouldBlock(url))return undefined;
        return createEmptyResp();
      })
      .onPageBegin(() => { this.onWebPageBegin?.(); })
      .onProgressChange(e => { this.onWebProgress?.(e?.newProgress ?? 0); })
      .onPageEnd(() => { this.onWebPageEnd?.(); })
      .width('100%').height('100%')
      .clip(true)
      .backgroundColor('#000');
  }
}
