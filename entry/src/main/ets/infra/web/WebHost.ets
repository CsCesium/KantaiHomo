import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetBool, kvGetString, kvSet } from "../storage/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, HostMode, LayoutDecision, WindowScene } from "./layout/responsive";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { promptAction, window } from "@kit.ArkUI";
import { getMainWindowCached } from '../appContext';
import ButtonColumn from "./components/ButtonColumn";
import GameWeb from "./components/GameWeb";
import { lengthToNumber } from "../utils/trans";
import PanelHost from "../../app/pages/components/panel/PanelHost";
import { decidePanelLayout, PanelDimens, PanelLayoutConfig, PanelMode } from "../../features/panel";
import FleetStatusSidebar from "../../app/pages/components/sidebar/FleetStatusSidebar";
import BattleStatsWidget from "../../app/pages/components/BattleStatsWidget";
import { APP_STORAGE_SHOW_SIDEBAR, APP_STORAGE_YASEN_DETECT_ENABLED, APP_STORAGE_ADVANCE_GUARD_ENABLED, APP_STORAGE_INJECT_FPS, APP_STORAGE_INJECT_TOUCH_PATCH, APP_STORAGE_INJECT_TICKER_RAF, APP_STORAGE_INJECT_PIXI_PATCH } from "../../ability/Entry";
import { subscribeAlert, SortieStartTaihaAlert } from "../../features/alerts";

interface RpcPayload {
  op: string;
  key?: string;
  value?: string;
  def?: string;
}

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
  @State private panelConfig: PanelLayoutConfig = { mode: PanelMode.Hidden, bottomPanelHeight: 0 };
  @State private sidebarWidthVp: number = 0;
  /** Mirrors ui.showSidebar AppStorage preference; updates immediately when user toggles in Settings. */
  @StorageProp(APP_STORAGE_SHOW_SIDEBAR) private showSidebarPref: boolean = true;
  /** Mirrors alerts.yasen.enabled; controls YasenDetect JS injection on each page load. */
  @StorageProp(APP_STORAGE_YASEN_DETECT_ENABLED) private yasenDetectEnabled: boolean = true;
  /** Mirrors alerts.advanceGuard.enabled; controls AdvanceDetect JS injection. */
  @StorageProp(APP_STORAGE_ADVANCE_GUARD_ENABLED) private advanceGuardEnabled: boolean = true;
  @StorageProp(APP_STORAGE_INJECT_FPS) private injectFpsEnabled: boolean = false;
  @StorageProp(APP_STORAGE_INJECT_TOUCH_PATCH) private injectTouchPatch: boolean = false;
  @StorageProp(APP_STORAGE_INJECT_TICKER_RAF) private injectTickerRaf: boolean = false;
  @StorageProp(APP_STORAGE_INJECT_PIXI_PATCH) private injectPixiPatch: boolean = false;
  // Test-only: manually force the FloatOverlay panel open regardless of layout mode.
  // Remove once the fairy ball → panel trigger is wired up.
  @State private overlayForced: boolean = false;

  private windowStatusCb?: (nextStatus: window.WindowStatusType) => void;
  private unsubSortieStartTaiha?: () => void;

  private getInjectOptions = (): Required<InjectOptions> => ({
    channelName: defaultInjectOptions.channelName,
    postMethod: defaultInjectOptions.postMethod,
    apiFilter: defaultInjectOptions.apiFilter,
    enableXHRHook: defaultInjectOptions.enableXHRHook,
    enableFetchHook: defaultInjectOptions.enableFetchHook,
    enableSessionPersist: defaultInjectOptions.enableSessionPersist,
    enableIframeFit: defaultInjectOptions.enableIframeFit,
    enableDebug: defaultInjectOptions.enableDebug,
    enableYasenDetect: this.yasenDetectEnabled,
    enableAdvanceDetect: this.advanceGuardEnabled,
    enableFPS: this.injectFpsEnabled,
    enableTouchPatch: this.injectTouchPatch,
    enableTickerRAF: this.injectTickerRaf,
    enablePixiPatch: this.injectPixiPatch,
  });

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

  private applyImmersiveLayoutForScene(win: window.Window): void {
    // Split windows share system bars with other apps; keep non-immersive.
    // Fullscreen and floating are edge-to-edge: immersive layout required so
    // the hidden system bars don't leave a reserved-but-empty inset at the edges.
    void win.setWindowLayoutFullScreen(this.scene !== WindowScene.SPLIT);
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
    });
    let nextMode: HostMode = decision.mode;
    let nextFit: FitPolicy = decision.policy;
    let nextFitLocked: boolean = decision.lockFit;
    let nextShowSideButtons: boolean = decision.showSideButtons;
    let nextShowBottomTools: boolean = decision.showBottomTools;
    let nextGameWidthVp: number = decision.gameWidthVp;
    let nextGameHeightVp: number = decision.gameHeightVp;
    let nextGameLeftMarginVp: number = decision.gameLeftMarginVp;
    let nextSidebarWidthVp: number = decision.sidebarWidthVp;

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
      nextSidebarWidthVp = 0;
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
    this.sidebarWidthVp = nextSidebarWidthVp;

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
      sidebarWidthVp: nextSidebarWidthVp,
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

  private showAdvanceWarningDialog(msg: string): void {
    promptAction.showDialog({
      title: '⚠️ 大破进击警告',
      message: msg,
      buttons: [
        { text: '撤退', color: '#6A9AB5' },
        { text: '继续进击', color: '#e53935' },
      ],
    }).catch((_e: Error) => {});
  }

  private showSortieStartTaihaDialog(alert: SortieStartTaihaAlert): void {
    const lines = alert.ships.map(s => `${s.name} (${s.hpNow}/${s.hpMax})`).join('\n');
    promptAction.showDialog({
      title: '⚠️ 出击大破警告',
      message: `第${alert.deckId}舰队以下舰娘大破出击，存在击沉风险：\n${lines}`,
      buttons: [
        { text: '已知悉', color: '#e53935' },
      ],
    }).catch((_e: Error) => {});
  }

  aboutToAppear() {
    const ctx = getContext(this) as common.UIAbilityContext;
    this.host = new WebHostController(this.controller, ctx, this.getFit, this.getInjectOptions, (r: string) => this.rpcHandler(r));
    this.host.setAdvanceWarningHandler((msg: string) => { this.showAdvanceWarningDialog(msg); });
    this.unsubSortieStartTaiha = subscribeAlert<SortieStartTaihaAlert>('sortie_start_taiha', (a) => {
      this.showSortieStartTaihaDialog(a);
    });
    this.host.bindDisplay();
    void this.host.applyOrientationByMode(true);
    void this.loadRuntimeConfig();

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

    if (this.unsubSortieStartTaiha) {
      this.unsubSortieStartTaiha();
      this.unsubSortieStartTaiha = undefined;
    }

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
    if (this.scene === WindowScene.SPLIT) {
      // Split mode: respect side system UI shared with other windows.
      return [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM];
    }
    // Fullscreen and floating: expand all edges for true edge-to-edge layout.
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
          // 左下角纵向排列：ButtonColumn 在上，战果在下
          Column() {
            ButtonColumn({
              onRefresh: () => this.controller.refresh(),
              onTogglePanel: () => { this.overlayForced = !this.overlayForced; },
              onLogout: () => this.promptLogout(),
              panelActive: this.overlayForced,
            })
              .width(56)
              .padding({ left: 4, right: 4, top: 8, bottom: 8 })
            BattleStatsWidget()
              .margin({ left: 4, bottom: 6 })
          }
          .align(Alignment.BottomStart)
          .alignItems(HorizontalAlign.Start)
        }

        // Fleet status sidebar — right-side persistent status bar.
        // Conditions mirror shouldShowFloatingButtons: compact mode + fullscreen only.
        // Use absolute position to anchor to the right edge of the Stack (align() only
        // sets internal content alignment and does NOT reposition within the parent).
        if (this.showSidebarPref && this.sidebarWidthVp > 0 && this.shouldShowFloatingButtons()) {
          FleetStatusSidebar({ sidebarWidth: this.sidebarWidthVp })
            .width(this.sidebarWidthVp)
            .height('100%')
            .align(Alignment.TopEnd)
            .position({ x: this.viewportWidthVp - this.sidebarWidthVp, y: 0 })
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
