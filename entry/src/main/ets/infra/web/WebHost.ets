import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetString, kvSet } from "../storage/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, HostMode, WideSplitMode, WindowScene } from "./layout/responsive";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { window } from "@kit.ArkUI";
import display from "@ohos.display";
import ButtonColumn from "./components/ButtonColumn";
import GameWeb from "./components/GameWeb";
import { lengthToNumber } from "../utils/trans";

interface RpcPayload {
  op: string;
  key?: string;
  value?: string;
  def?: string;
}

const LAYOUT_WIDE_SPLIT_MODE_KEY = 'layout.wideSplitMode';

@Entry
@Component
export default struct WebHost {
  private controller: webview.WebviewController = new webview.WebviewController();
  private host!: WebHostController;

  private readonly HOME: string = HOME_URL;
  @State private progress: number = 0;
  @State private mode: HostMode = HostMode.COMPACT;
  @State private lastMode: HostMode | null = null;
  @State private fit: FitPolicy = 'height';
  @State private fitLocked: boolean = true;
  @State private showSideButtons: boolean = true;
  @State private showBottomTools: boolean = false;
  @State private gameHeightVp: number = 0;
  @State private gameWidthVp: number = 0;
  @State private gameLeftMarginVp: number = 0;
  @State private viewportWidthVp: number = 0;
  @State private viewportHeightVp: number = 0;
  @State private scene: WindowScene = WindowScene.FULLSCREEN;
  @State private wideSplitMode: WideSplitMode = WideSplitMode.PORTRAIT_FILL;

  private windowStatusCb?: (nextStatus: window.WindowStatusType) => void;

  private getInjectOptions = (): Required<InjectOptions> => {
    return {
      channelName: 'hmos',
      postMethod: 'post',
      apiFilter: '/\\/kcsapi\\//',
      //apiFilter: '/.*/',//debug

      enableXHRHook: true,
      enableFetchHook: true,
      enableFPS: defaultInjectOptions.enableFPS,
      enableTouchPatch: defaultInjectOptions.enableTouchPatch,
      enableTickerRAF: defaultInjectOptions.enableTickerRAF,
      enablePixiPatch: defaultInjectOptions.enablePixiPatch,
      enableSessionPersist: defaultInjectOptions.enableSessionPersist,
      enableIframeFit: defaultInjectOptions.enableIframeFit,
      enableYasenDetect: defaultInjectOptions.enableYasenDetect,
      enableDebug:defaultInjectOptions.enableDebug,
    };
  };

  private getFit = (): FitGetter => ({
    policy: this.fit,
    locked: this.fitLocked,
    viewportW: this.gameWidthVp,
    viewportH: this.gameHeightVp
  });

  private async rpcHandler(raw: string): Promise<string> {
    try {
      const p = JSON.parse(raw) as Record<string, string>;
      const op: string = typeof p.op === 'string' ? p.op : '';
      const key: string = typeof p.key === 'string' ? p.key : '';
      const valStr: string = typeof p.value === 'string' ? p.value : '';
      const defStr: string = typeof p.def === 'string' ? p.def : '';

      if (op === 'kv.get') {
        const v = await kvGetString(key, defStr);
        return JSON.stringify({ ok: true, value: v });
      }
      if (op === 'kv.set') {
        await kvSet(key, valStr);
        return JSON.stringify({ ok: true });
      }
      if (op === 'kv.delete') {
        await kvDelete(key);
        return JSON.stringify({ ok: true });
      }
      return JSON.stringify({ ok: false, error: 'unsupported op' });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  }

  private resolveSceneByStatus(status: window.WindowStatusType): WindowScene {
    if (status === window.WindowStatusType.FLOATING) {
      return WindowScene.FLOATING;
    }
    if (status === window.WindowStatusType.FULL_SCREEN) {
      return WindowScene.FULLSCREEN;
    }
    return WindowScene.SPLIT;
  }


  private ensureFloatingWindowRatio(win: window.Window): void {
    // Force floating window to 1200:720 ratio so game content fully occupies the window.
    try {
      const ratioW: number = 1200;
      const ratioH: number = 720;
      const disp = display.getDefaultDisplaySync();
      const maxW: number = Number(disp.width);
      const maxH: number = Number(disp.height);
      const scale: number = Math.min(maxW / ratioW, maxH / ratioH);
      const targetW: number = Math.floor(ratioW * scale);
      const targetH: number = Math.floor(ratioH * scale);
      win.resize(targetW, targetH);
    } catch (e) {
      console.error('[WebHost] ensureFloatingWindowRatio failed:', e);
    }
  }

  private parseWideSplitMode(raw: string): WideSplitMode {
    if (raw === WideSplitMode.LANDSCAPE_WITH_DASHBOARD) {
      return WideSplitMode.LANDSCAPE_WITH_DASHBOARD;
    }
    return WideSplitMode.PORTRAIT_FILL;
  }

  // Centralized layout update for area/window changes.
  private recalcLayout(widthVp: number, heightVp: number): void {
    if (widthVp <= 0 || heightVp <= 0) {
      return;
    }

    const decision = decideLayout({
      widthVp,
      heightVp,
      scene: this.scene,
      wideSplitMode: this.wideSplitMode,
    });

    const modeChanged: boolean = this.lastMode !== decision.mode;

    this.mode = decision.mode;
    this.fit = decision.policy;
    this.fitLocked = decision.lockFit;
    this.showSideButtons = decision.showSideButtons;
    this.showBottomTools = decision.showBottomTools;
    this.gameWidthVp = decision.gameWidthVp;
    this.gameHeightVp = decision.gameHeightVp;
    this.gameLeftMarginVp = decision.gameLeftMarginVp;

    void this.host.applyOrientationByMode(this.mode === HostMode.COMPACT);
    if (modeChanged) {
      this.host.onPageEnd();
    }
    this.lastMode = this.mode;
  }

  aboutToAppear() {
    const ctx = getContext(this) as common.UIAbilityContext;
    this.host = new WebHostController(this.controller, ctx, this.getFit, this.getInjectOptions, (r: string) => this.rpcHandler(r));
    this.host.bindDisplay();
    void this.host.applyOrientationByMode(true);

    // Preload split policy for wide left/right mode.
    void kvGetString(LAYOUT_WIDE_SPLIT_MODE_KEY, WideSplitMode.PORTRAIT_FILL)
      .then((v) => {
        this.wideSplitMode = this.parseWideSplitMode(v);
        this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
      });

    window.getLastWindow(ctx).then(win => {
      void win.setWindowLayoutFullScreen(true);
      void win.setWindowSystemBarEnable([]);

      const status = win.getWindowStatus();
      this.scene = this.resolveSceneByStatus(status);
      if (this.scene === WindowScene.FLOATING) {
        void win.setWindowLayoutFullScreen(false);
        this.ensureFloatingWindowRatio(win);
      } else {
        void win.setWindowLayoutFullScreen(true);
      }
      this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);

      // Keep scene in sync when entering split-screen or floating window.
      this.windowStatusCb = (nextStatus: window.WindowStatusType) => {
        this.scene = this.resolveSceneByStatus(nextStatus);
        if (this.scene === WindowScene.FLOATING) {
          void win.setWindowLayoutFullScreen(false);
          this.ensureFloatingWindowRatio(win);
        } else {
          void win.setWindowLayoutFullScreen(true);
        }
        this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
      };
      win.on('windowStatusChange', this.windowStatusCb);
    });

    webview.WebviewController.setWebDebuggingAccess(true);//Chrome DevTool debug
  }

  aboutToDisappear() {
    this.host.unbindDisplay();

    const ctx = getContext(this) as common.UIAbilityContext;
    if (this.windowStatusCb) {
      window.getLastWindow(ctx).then(win => {
        win.off('windowStatusChange', this.windowStatusCb);
      });
    }
  }

  private onWebAttached = () => { this.host.attach(); }
  private onBegin = () => { this.progress = 5; this.host.onPageBegin(); }
  private onProg = (p: number) => { this.progress = p; }
  private onEnd = () => {
    this.progress = 100;
    this.host.onPageEnd();
    void this.host.applyOrientationByMode(this.mode === HostMode.COMPACT);
  }

  build() {
    Column() {
      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress }).width('100%').height(2).backgroundColor('#222')
      }

      Row() {
        ButtonColumn({ onRefresh: () => this.controller.refresh() })
          .width(this.showSideButtons ? 56 : 0)
          .visibility(this.showSideButtons ? Visibility.Visible : Visibility.None)
          .padding({ left: 4, right: 4, top: 8, bottom: 8 })
          .align(Alignment.BottomStart)

        Stack({ alignContent: Alignment.TopStart }) {
          GameWeb({
            src: this.HOME,
            controller: this.controller,
            onWebAttached: this.onWebAttached,
            onWebPageBegin: this.onBegin,
            onWebProgress: this.onProg,
            onWebPageEnd: this.onEnd
          })
        }
        .margin({left: this.gameLeftMarginVp})
        .width("100%")
        .height("100%")
        .clip(true)
      }
      .height(this.showBottomTools ? this.gameHeightVp : "auto")
      .constraintSize(this.showBottomTools ? { minHeight: this.gameHeightVp, maxHeight: this.gameHeightVp } : {})
      .layoutWeight(this.showBottomTools ? 0 : 1)
      .width('100%')
      .backgroundColor('#000')

      Row() {
        ButtonColumn({ onRefresh: () => this.controller.refresh() })
          .width(56)
          .height('100%')
          .opacity(1)
          .zIndex(2)
          .padding({ left: 8 });
        Blank().layoutWeight(1)
      }
      .height(this.showBottomTools ? "auto" : 0)
      .visibility(this.showBottomTools ? Visibility.Visible : Visibility.None)
      .layoutWeight(this.showBottomTools ? 1 : 0)
      .alignItems(VerticalAlign.Center)
      .justifyContent(FlexAlign.Start)
      .width('100%')
      .backgroundColor('#0b0b0b')
    }
    .height('100%')
    .width('100%')
    .backgroundColor('#000')
    .expandSafeArea([SafeAreaType.SYSTEM],this.mode === HostMode.COMPACT
      ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM]
      : [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END]
    )
    .onAreaChange((_, area) => {
      const w: number = lengthToNumber(area.width);
      const h: number = lengthToNumber(area.height);
      this.viewportWidthVp = w;
      this.viewportHeightVp = h;
      this.recalcLayout(w, h);
    })
  }
}
