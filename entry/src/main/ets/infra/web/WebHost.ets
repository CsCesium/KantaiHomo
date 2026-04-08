import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetBool, kvGetString, kvSet } from "../storage/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, HostMode, LayoutDecision, WideSplitMode, WindowScene } from "./layout/responsive";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { promptAction, window } from "@kit.ArkUI";
import { getMainWindowCached } from '../appContext';
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
  private homeOverride: string = '';
  private firstPageLoad: boolean = true;
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
  // Test-only: manually force the FloatOverlay panel open regardless of layout mode.
  // Remove once the fairy ball → panel trigger is wired up.
  @State private overlayForced: boolean = false;

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

  private applyImmersiveLayoutForScene(win: window.Window): void {
    // Floating window should be immersive (edge-to-edge).
    // Other scenes keep non-immersive layout to avoid unexpected system-bar overlap.
    void win.setWindowLayoutFullScreen(this.scene === WindowScene.FLOATING);
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

  private async loadRuntimeConfig(): Promise<void> {
    const runtimeConfig = await Promise.all([
      kvGetString('config.homeUrl', ''),
      kvGetString('config.userAgent', ''),
      kvGetBool('clear.cache.pending', false),
    ]);
    const homeOverride = runtimeConfig[0];
    const uaOverride = runtimeConfig[1];
    const clearPending = runtimeConfig[2];

    if (uaOverride) {
      try { this.controller.setCustomUserAgent(uaOverride); } catch (_e) {}
    }
    if (homeOverride && homeOverride !== HOME_URL) {
      this.homeOverride = homeOverride;
    }
    if (clearPending) {
      try { this.controller.removeCache(true); } catch (_e) {}
      void kvDelete('clear.cache.pending');
    }
  }

  private async tryAutoFill(): Promise<void> {
    const userConfig = await Promise.all([
      kvGetString('account.username', ''),
      kvGetString('account.password', ''),
    ]);
    const username = userConfig[0];
    const password = userConfig[1];
    if (!username && !password) {
      return;
    }

    const u = JSON.stringify(username);
    const p = JSON.stringify(password);
    const js: string =
      '(function(){'
      + 'try{'
      + 'if(!document.querySelector(\'input[type="password"]\')) return;'
      + 'function fill(sels,val){'
      + '  for(var i=0;i<sels.length;i++){'
      + '    var el=document.querySelector(sels[i]);'
      + '    if(el&&el.type!=="hidden"){'
      + '      var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");'
      + '      if(d&&d.set) d.set.call(el,val);'
      + '      el.dispatchEvent(new Event("input",{bubbles:true}));'
      + '      el.dispatchEvent(new Event("change",{bubbles:true}));'
      + '      return true;'
      + '    }'
      + '  }'
      + '  return false;'
      + '}'
      + 'fill(["#login_id","input[name=\\"login_id\\"]","input[type=\\"email\\"]","input[name=\\"username\\"]","input[name=\\"email\\"]"],' + u + ');'
      + 'fill(["#password","input[name=\\"password\\"]","input[type=\\"password\\"]"],' + p + ');'
      + '}catch(e){console.warn("[autofill]",e);}'
      + '})();';

    if (typeof this.controller.runJavaScript === 'function') {
      this.controller.runJavaScript(js);
    }
  }

  aboutToAppear() {
    const ctx = getContext(this) as common.UIAbilityContext;
    this.host = new WebHostController(this.controller, ctx, this.getFit, this.getInjectOptions, (r: string) => this.rpcHandler(r));
    this.host.bindDisplay();
    void this.host.applyOrientationByMode(true);
    void this.loadRuntimeConfig();

    // Preload split policy for wide left/right mode.
    void kvGetString(LAYOUT_WIDE_SPLIT_MODE_KEY, WideSplitMode.PORTRAIT_FILL)
      .then((v) => {
        this.wideSplitMode = this.parseWideSplitMode(v);
        this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
      });

    const mainWin = getMainWindowCached();
    if (mainWin) {
      void mainWin.setWindowSystemBarEnable([]);

      const status = mainWin.getWindowStatus();
      this.scene = this.resolveScene(status);
      this.applyImmersiveLayoutForScene(mainWin);
      this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);

      // Keep scene in sync when entering split-screen or floating window.
      this.windowStatusCb = (nextStatus: window.WindowStatusType) => {
        this.scene = this.resolveScene(nextStatus);
        this.applyImmersiveLayoutForScene(mainWin);
        this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
      };
      mainWin.on('windowStatusChange', this.windowStatusCb);
    }

    webview.WebviewController.setWebDebuggingAccess(true);//Chrome DevTool debug
  }

  aboutToDisappear() {
    this.host.unbindDisplay();

    if (this.windowStatusCb) {
      const mainWin = getMainWindowCached();
      if (mainWin) {
        mainWin.off('windowStatusChange', this.windowStatusCb);
      }
    }
  }

  private doLogout(): void {
    webview.WebCookieManager.clearAllCookiesSync();
    void kvDelete('dmm.cookie.backup.v1');
    this.controller.loadUrl(this.HOME);
  }

  private promptLogout(): void {
    promptAction.showDialog({
      title: '确认登出',
      message: '将清除登录 Cookie 及页面缓存，并跳转到登录页。',
      buttons: [
        { text: '取消',   color: '#888888' },
        { text: '确认登出', color: '#e53935' },
      ],
    }).then((result) => {
      if (result.index === 1) { this.doLogout(); }
    }).catch((_e: Error) => {});
  }

  private onWebAttached = () => { this.host.attach(); }
  private onBegin = () => { this.progress = 5; this.host.onPageBegin(); }
  private onProg = (p: number) => { this.progress = p; }
  private onEnd = () => {
    this.progress = 100;
    this.host.onPageEnd();
    void this.host.applyOrientationByMode(this.mode === HostMode.COMPACT);

    // One-shot redirect to configured home URL on first load.
    if (this.firstPageLoad && this.homeOverride) {
      this.firstPageLoad = false;
      const override = this.homeOverride;
      this.homeOverride = '';
      try {
        if (this.controller.getUrl() !== override) {
          this.controller.loadUrl(override);
        }
      } catch (_e) {}
    } else {
      this.firstPageLoad = false;
    }

    // Auto-fill credentials on login pages.
    void this.tryAutoFill();
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

  private shouldShowFloatingButtons(): boolean {
    const fullscreen: boolean = this.scene === WindowScene.FULLSCREEN;
    if (!fullscreen) {
      return false;
    }
    const nonCompactVisible: boolean = this.showSideButtons &&
      (this.panelConfig.mode !== PanelMode.FloatOverlay || this.overlayForced);
    return this.mode === HostMode.COMPACT || nonCompactVisible;
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

        // Unified floating controls (fullscreen only):
        // - COMPACT fullscreen: always show
        // - non-COMPACT fullscreen: mirror the original side-button visibility condition
        // Split/Floating scenes are intentionally hidden.
        if (this.shouldShowFloatingButtons()) {
          ButtonColumn({
            onRefresh: () => this.controller.refresh(),
            onTogglePanel: () => { this.overlayForced = !this.overlayForced; },
            onLogout: () => this.promptLogout(),
            panelActive: this.overlayForced,
          })
            .width(56)
            .padding({ left: 4, right: 4, top: 8, bottom: 8 })
            .align(Alignment.BottomStart)
        }

        // FloatOverlay panel — overlaid on the game viewport.
        // Only shown when explicitly triggered (overlayForced / fairy ball event).
        // Side margins act as dismiss areas; tapping outside panel hides it.
        if (this.overlayForced) {
          Row() {
            Column()
              .width(PanelDimens.overlaySideGap)
              .height('100%')
              .backgroundColor(Color.Transparent)
              .onClick(() => { this.overlayForced = false; })
            PanelHost({ config: { mode: PanelMode.FloatOverlay, bottomPanelHeight: 0 } })
              .layoutWeight(1)
              .height('100%')
            Column()
              .width(PanelDimens.overlaySideGap)
              .height('100%')
              .backgroundColor(Color.Transparent)
              .onClick(() => { this.overlayForced = false; })
          }
          .width('100%')
          .height('100%')
        }
      }
      .height(this.showBottomTools ? this.gameHeightVp : '100%')
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
      const mainWin = getMainWindowCached();
      if (mainWin) {
        const status = mainWin.getWindowStatus();
        this.scene = this.resolveScene(status);
        this.applyImmersiveLayoutForScene(mainWin);
      }
      this.recalcLayout(w, h);
    })
  }
}
