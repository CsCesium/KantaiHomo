import { webview } from "@kit.ArkWeb";
import { HOME_URL } from "../config";
import { gameAssetInterceptor } from "../../../features/resourceCache";
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
  @Param resourceCacheEnabled: boolean = false;
  @Param resourceCacheAudioEnabled: boolean = false;

  build() {
    Web({ src: this.src, controller: this.controller })
      .javaScriptAccess(true)
      .domStorageAccess(true)
      .fileAccess(true)
      .zoomAccess(false)
      .enableWebAVSession(false)
      .onControllerAttached(() => { this.onWebAttached?.(); })
      .onLoadIntercept(() => false)
      .onInterceptRequest((ev) => {
        if (!ev?.request) return undefined;
        const reqUrl: string = ev.request.getRequestUrl() || '';
        if (!reqUrl) return undefined;
        if (shouldBlock(reqUrl)) return createEmptyResp();
        if (this.resourceCacheEnabled) {
          const cached = gameAssetInterceptor(ev, { enableAudio: this.resourceCacheAudioEnabled });
          if (cached) return cached;
        }
        return undefined;
      })
      .onPageBegin(() => { this.onWebPageBegin?.(); })
      .onProgressChange(e => { this.onWebProgress?.(e?.newProgress ?? 0); })
      .onPageEnd(() => { this.onWebPageEnd?.(); })
      .width('100%').height('100%')
      .clip(true)
      .backgroundColor('#000');
  }
}
