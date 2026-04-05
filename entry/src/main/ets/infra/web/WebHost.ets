import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetString, kvSet } from "../storage/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, HostMode, LayoutDecision, WideSplitMode, WindowScene } from "./layout/responsive";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { window } from "@kit.ArkUI";
import ButtonColumn from "./components/ButtonColumn";
import GameWeb from "./components/GameWeb";
import { lengthToNumber } from "../utils/trans";
import PanelHost from "../../app/pages/components/panel/PanelHost";
import { decidePanelLayout, PanelDimens, PanelLayoutConfig, PanelMode } from "../../features/panel";

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
  @State private panelConfig: PanelLayoutConfig = { mode: PanelMode.Hidden, bottomPanelHeight: 0 };

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

  private resolveScene(status: window.WindowStatusType): WindowScene {
    const byStatus: WindowScene = this.resolveSceneByStatus(status);
    // Window status is the source of truth.
    // Folded/fullscreen devices may have a reduced rect, but should still be treated as fullscreen.
    return byStatus;
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
    let nextMode: HostMode = decision.mode;
    let nextFit: FitPolicy = decision.policy;
    let nextFitLocked: boolean = decision.lockFit;
    let nextShowSideButtons: boolean = decision.showSideButtons;
    let nextShowBottomTools: boolean = decision.showBottomTools;
    let nextGameWidthVp: number = decision.gameWidthVp;
    let nextGameHeightVp: number = decision.gameHeightVp;
    let nextGameLeftMarginVp: number = decision.gameLeftMarginVp;

    const isSmallLandscapeWindow: boolean = (widthVp > heightVp) && (heightVp <= 650);
    const isFloatingScene: boolean = this.scene === WindowScene.FLOATING;
    const isSplitScene: boolean = this.scene === WindowScene.SPLIT;
    // Split/floating small windows should always be pure game canvas without fixed tool columns.
    if ((isSmallLandscapeWindow && isSplitScene) || isFloatingScene) {
      nextMode = HostMode.COMPACT;
      nextFit = isFloatingScene ? 'width' : 'height';
      nextFitLocked = true;
      nextShowSideButtons = false;
      nextShowBottomTools = false;
      nextGameWidthVp = widthVp;
      nextGameHeightVp = heightVp;
      nextGameLeftMarginVp = 0;
    }

    const modeChanged: boolean = this.lastMode !== nextMode;

    this.mode = nextMode;
    this.fit = nextFit;
    this.fitLocked = nextFitLocked;
    this.showSideButtons = nextShowSideButtons;
    this.showBottomTools = nextShowBottomTools;
    this.gameWidthVp = nextGameWidthVp;
    this.gameHeightVp = nextGameHeightVp;
    this.gameLeftMarginVp = nextGameLeftMarginVp;

    // Derive panel layout from the final (override-adjusted) layout decision.
    const finalDecision: LayoutDecision = {
      mode: nextMode,
      policy: nextFit,
      lockFit: nextFitLocked,
      showSideButtons: nextShowSideButtons,
      showBottomTools: nextShowBottomTools,
      gameWidthVp: nextGameWidthVp,
      gameHeightVp: nextGameHeightVp,
      gameLeftMarginVp: nextGameLeftMarginVp,
    };
    this.panelConfig = decidePanelLayout(finalDecision, heightVp);

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
      this.scene = this.resolveScene(status);
      if (this.scene === WindowScene.FLOATING) {
        // Floating mode uses immersive layout so game canvas can occupy full horizontal viewport.
        void win.setWindowLayoutFullScreen(true);
      } else {
        void win.setWindowLayoutFullScreen(true);
      }
      this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);

      // Keep scene in sync when entering split-screen or floating window.
      this.windowStatusCb = (nextStatus: window.WindowStatusType) => {
        this.scene = this.resolveScene(nextStatus);
        if (this.scene === WindowScene.FLOATING) {
          // Keep floating window immersive after status transitions.
          void win.setWindowLayoutFullScreen(true);
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

  private getSafeAreaEdges(): SafeAreaEdge[] {
    if (this.scene === WindowScene.FLOATING) {
      return [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END];
    }
    if (this.mode === HostMode.COMPACT) {
      return [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM];
    }
    return [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END];
  }

  build() {
    Column() {
      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress }).width('100%').height(2).backgroundColor('#222')
      }

      // Game area.
      // Wrapped in Stack so FloatOverlayPanel can be laid on top without affecting
      // the game Row's layout. The Stack carries the same size constraints that
      // the Row used to carry directly.
      Stack({ alignContent: Alignment.TopStart }) {
        Row() {
          // Side tool column — hidden when FloatOverlay panel is active (panel covers
          // the same left area) or when the layout already suppresses it.
          ButtonColumn({ onRefresh: () => this.controller.refresh() })
            .width(this.showSideButtons && this.panelConfig.mode !== PanelMode.FloatOverlay ? 56 : 0)
            .visibility(this.showSideButtons && this.panelConfig.mode !== PanelMode.FloatOverlay
              ? Visibility.Visible : Visibility.None)
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
          .margin({ left: this.gameLeftMarginVp })
          .width("100%")
          .height("100%")
          .clip(true)
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#000')

        // FloatOverlay panel — overlaid on the left edge of the game viewport.
        if (this.panelConfig.mode === PanelMode.FloatOverlay) {
          PanelHost({ config: this.panelConfig })
            .width(PanelDimens.overlayPanelW)
            .height('100%')
        }
      }
      .height(this.showBottomTools ? this.gameHeightVp : "auto")
      .constraintSize(this.showBottomTools ? { minHeight: this.gameHeightVp, maxHeight: this.gameHeightVp } : {})
      .layoutWeight(this.showBottomTools ? 0 : 1)
      .width('100%')

      // Bottom panel — replaces the old bottom ButtonColumn row entirely.
      // Rendered only in EXPANDED mode; fills the remaining vertical space.
      if (this.panelConfig.mode === PanelMode.BottomPanel) {
        PanelHost({ config: this.panelConfig })
          .width('100%')
          .layoutWeight(1)
      }
    }
    .height('100%')
    .width('100%')
    .backgroundColor('#000')
    .expandSafeArea([SafeAreaType.SYSTEM], this.getSafeAreaEdges())
    .onAreaChange((_oldArea: Area, area: Area) => {
      const w: number = lengthToNumber(area.width);
      const h: number = lengthToNumber(area.height);
      this.viewportWidthVp = w;
      this.viewportHeightVp = h;
      const ctx = getContext(this) as common.UIAbilityContext;
      window.getLastWindow(ctx).then((win) => {
        const status = win.getWindowStatus();
        this.scene = this.resolveScene(status);
        this.recalcLayout(w, h);
      });
    })
  }
}
