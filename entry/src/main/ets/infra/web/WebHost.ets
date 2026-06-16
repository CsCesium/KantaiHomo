import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetBool, kvGetString, kvSet } from "../storage/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, GAME_ASPECT_RATIO, HostMode, LayoutDecision, WindowScene } from "./layout/responsive";
import { GameViewportBox, GAME_SIZE_DEFAULT_PERCENT, resolveGameViewportBox } from "./layout/gameSize";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { promptAction, window } from "@kit.ArkUI";
import { getMainWindowCached } from '../appContext';
import ButtonColumn from "./components/ButtonColumn";
import ButtonRow from "./components/ButtonRow";
import GameWeb from "./components/GameWeb";
import { lengthToNumber } from "../utils/trans";
import PanelHost from "../../app/pages/components/panel/PanelHost";
import { decidePanelLayout, PanelDimens, PanelLayoutConfig, PanelMode } from "../../features/panel";
import FleetStatusSidebar from "../../app/pages/components/sidebar/FleetStatusSidebar";
import BattleStatsWidget from "../../app/pages/components/BattleStatsWidget";
import { APP_STORAGE_SHOW_SIDEBAR, APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW, APP_STORAGE_YASEN_DETECT_ENABLED, APP_STORAGE_ADVANCE_GUARD_ENABLED, APP_STORAGE_INJECT_FPS, APP_STORAGE_INJECT_TOUCH_PATCH, APP_STORAGE_INJECT_TICKER_RAF, APP_STORAGE_INJECT_PIXI_PATCH,
  APP_STORAGE_SIDEBAR_SHOW_AVATAR, APP_STORAGE_INJECT_TOUCH_HOVER, APP_STORAGE_INJECT_TOUCH_WHEEL,
  APP_STORAGE_GAME_SIZE_COMPACT, APP_STORAGE_GAME_SIZE_EXPANDED, APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY } from "../../ability/Entry";
import { TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT } from "./input/touchWheelSensitivity";
import { subscribeAlert, SortieStartTaihaAlert } from "../../features/alerts";
import { APP_STORAGE_RESOURCE_CACHE_AUDIO, APP_STORAGE_RESOURCE_CACHE_ENABLED } from "../../features/resourceCache";
import { isInBattle, subscribeGameState } from "../../features/state";
import EquipInfoPage from "../../app/pages/components/info/EquipInfoPage";
import ExpeditionInfoPage from "../../app/pages/components/info/ExpeditionInfoPage";
import RemodelInfoPage from "../../app/pages/components/info/RemodelInfoPage";
import ShipInfoPage from "../../app/pages/components/info/ShipInfoPage";
import { APP_STORAGE_SESSION_LOGOUT_REV } from "./session/logout";
import { registerWebHostPageVisibleHandler } from "./pageVisibility";
import {
  APP_STORAGE_APP_VOLUME_MUTED,
  subscribeAppVolumeMuted,
  syncAppVolumeMuted
} from "../audio/appVolume";

const NARROW_SHORT_SIDE_VP: number = 420;
const FLOATING_TOOL_SURFACE_MIN_WIDTH_VP: number = 700;
const LEFT_BUTTON_COLUMN_WIDTH_VP: number = 56;
const LEFT_BUTTON_COLUMN_FULL_HEIGHT_VP: number = 344;
const FLOATING_BATTLE_STATS_RESERVED_HEIGHT_VP: number = 48;
const CUTOUT_BUTTON_GUTTER_VP: number = 4;

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
  private fullReloadUrl: string = HOME_URL;
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
  @State private leftCutoutInsetVp: number = 0;
  /** Mirrors ui.showSidebar AppStorage preference; updates immediately when user toggles in Settings. */
  @StorageProp(APP_STORAGE_SHOW_SIDEBAR) private showSidebarPref: boolean = true;
  /** Mirrors ui.sidebar.showAvatar AppStorage preference; forwarded into the V2 sidebar component. */
  @StorageProp(APP_STORAGE_SIDEBAR_SHOW_AVATAR) private showSidebarAvatarPref: boolean = true;
  @StorageProp(APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW) private autoBattlePreviewFloatOverlay: boolean = true;
  /** Mirrors alerts.yasen.enabled; controls YasenDetect JS injection on each page load. */
  @StorageProp(APP_STORAGE_YASEN_DETECT_ENABLED) private yasenDetectEnabled: boolean = true;
  /** Mirrors alerts.advanceGuard.enabled; controls AdvanceDetect JS injection. */
  @StorageProp(APP_STORAGE_ADVANCE_GUARD_ENABLED) private advanceGuardEnabled: boolean = true;
  @StorageProp(APP_STORAGE_INJECT_FPS) private injectFpsEnabled: boolean = false;
  @StorageProp(APP_STORAGE_INJECT_TOUCH_PATCH) private injectTouchPatch: boolean = false;
  @StorageProp(APP_STORAGE_INJECT_TOUCH_HOVER) private injectTouchHover: boolean = true;
  @StorageProp(APP_STORAGE_INJECT_TOUCH_WHEEL) private injectTouchWheel: boolean = true;
  @StorageProp(APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY)
  private touchWheelSensitivityPercent: number = TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT;
  @StorageProp(APP_STORAGE_INJECT_TICKER_RAF) private injectTickerRaf: boolean = false;
  @StorageProp(APP_STORAGE_INJECT_PIXI_PATCH) private injectPixiPatch: boolean = false;
  @StorageProp(APP_STORAGE_RESOURCE_CACHE_ENABLED) private resourceCacheEnabled: boolean = false;
  @StorageProp(APP_STORAGE_RESOURCE_CACHE_AUDIO) private resourceCacheAudioEnabled: boolean = false;
  @StorageProp(APP_STORAGE_SESSION_LOGOUT_REV) private logoutRevision: number = 0;
  @StorageProp(APP_STORAGE_GAME_SIZE_COMPACT)
  @Watch('onGameSizePercentChanged')
  private compactGameSizePercent: number = GAME_SIZE_DEFAULT_PERCENT;
  @StorageProp(APP_STORAGE_GAME_SIZE_EXPANDED)
  @Watch('onGameSizePercentChanged')
  private expandedGameSizePercent: number = GAME_SIZE_DEFAULT_PERCENT;
  // Test-only: manually force the FloatOverlay panel open regardless of layout mode.
  // Remove once the fairy ball → panel trigger is wired up.
  @State private overlayForced: boolean = false;
  @State private battlePreviewAutoOverlayActive: boolean = false;
  @State private battlePreviewAutoOverlaySuppressed: boolean = false;
  // 折叠态全屏下手动切换为"游戏在上 + 底部面板"布局（与左右分屏的展开模式一致）。
  // 由 ButtonColumn 的 横/竖 按钮触发。
  @State private lrLayoutForced: boolean = false;
  @State private battlePreviewAvailable: boolean = false;
  @State private battlePreviewVisible: boolean = true;
  // Info overlay (ship list etc.) — rendered above the game without unmounting WebHost,
  // so the WebviewController instance and game state survive open/close.
  @State private shipInfoVisible: boolean = false;
  @State private equipInfoVisible: boolean = false;
  @State private expeditionInfoVisible: boolean = false;
  @State private remodelInfoVisible: boolean = false;

  private windowStatusCb?: (nextStatus: window.WindowStatusType) => void;
  private unsubSortieStartTaiha?: () => void;
  private unsubGameState?: () => void;
  private unsubAppVolumeMuted?: () => void;
  private unregisterPageVisible?: () => void;
  private chromeRefreshTimer: number = -1;
  private handledLogoutRevision: number = 0;
  private landscapeOrientationPending: boolean = false;
  private restoreLandscapeAfterManualLayout: boolean = false;

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
    enableTouchHover: this.injectTouchHover,
    enableTouchWheel: this.injectTouchWheel,
    touchWheelSensitivityPercent: this.touchWheelSensitivityPercent,
    enableTickerRAF: this.injectTickerRaf,
    enablePixiPatch: this.injectPixiPatch,
  });

  private getFit = (): FitGetter => ({
    policy: this.fit,
    locked: this.fitLocked,
    viewportW: this.gameWidthVp,
    viewportH: this.gameHeightVp
  });

  private onGameSizePercentChanged(): void {
    if (this.viewportWidthVp <= 0 || this.viewportHeightVp <= 0) {
      return;
    }
    this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
    if (this.host) {
      this.host.reapplyFit();
    }
  }

  private getGameViewportWidth(): Length {
    return this.gameWidthVp > 0 ? this.gameWidthVp : '100%';
  }

  private getGameViewportHeight(): Length {
    return this.gameHeightVp > 0 ? this.gameHeightVp : '100%';
  }

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
    if (status === window.WindowStatusType.SPLIT_SCREEN) {
      return WindowScene.SPLIT;
    }
    return WindowScene.FULLSCREEN;
  }

  private resolveScene(status: window.WindowStatusType): WindowScene {
    const byStatus: WindowScene = this.resolveSceneByStatus(status);
    // Window status is the source of truth.
    // Folded/fullscreen devices may have a reduced rect, but should still be treated as fullscreen.
    return byStatus;
  }

  private applyGameWindowChrome(win: window.Window): void {
    void win.setWindowSystemBarEnable([]);
    void win.setSpecificSystemBarEnabled('navigationIndicator', false, false);
    // Split windows share system bars with other apps; keep non-immersive.
    // Fullscreen and floating are edge-to-edge: immersive layout required so
    // the hidden system bars don't leave a reserved-but-empty inset at the edges.
    void win.setWindowLayoutFullScreen(this.scene !== WindowScene.SPLIT);
  }

  private scheduleGameWindowChromeRefresh(win: window.Window): void {
    if (this.chromeRefreshTimer >= 0) {
      clearTimeout(this.chromeRefreshTimer);
    }
    this.chromeRefreshTimer = setTimeout((): void => {
      this.chromeRefreshTimer = -1;
      this.applyGameWindowChrome(win);
    }, 1500);
  }

  private refreshSceneAndChrome(win: window.Window): void {
    const status = win.getWindowStatus();
    this.scene = this.resolveScene(status);
    this.applyGameWindowChrome(win);
  }

  private isPureGameFloatingWindow(widthVp: number = this.viewportWidthVp, heightVp: number = this.viewportHeightVp): boolean {
    return this.scene === WindowScene.FLOATING &&
      widthVp > heightVp &&
      widthVp < FLOATING_TOOL_SURFACE_MIN_WIDTH_VP &&
      heightVp <= NARROW_SHORT_SIDE_VP;
  }

  private getLayoutScene(widthVp: number, heightVp: number): WindowScene {
    if (this.scene === WindowScene.FLOATING && !this.isPureGameFloatingWindow(widthVp, heightVp)) {
      return WindowScene.FULLSCREEN;
    }
    return this.scene;
  }

  private isToolSurfaceScene(): boolean {
    return this.scene === WindowScene.FULLSCREEN ||
      (this.scene === WindowScene.SPLIT && this.viewportWidthVp > this.viewportHeightVp) ||
      this.getLayoutScene(this.viewportWidthVp, this.viewportHeightVp) === WindowScene.FULLSCREEN;
  }

  private restoreVisibleWindowState(pushWebFit: boolean = false): void {
    const mainWin = getMainWindowCached();
    if (mainWin) {
      this.refreshSceneAndChrome(mainWin);
      this.scheduleGameWindowChromeRefresh(mainWin);
    }
    this.refreshLeftCutoutInset();
    this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
    this.updateBattlePreviewAutoOverlay();
    if (pushWebFit && this.viewportWidthVp > 0 && this.viewportHeightVp > 0) {
      this.host.reapplyFit();
    }
  }

  private refreshLeftCutoutInset(): void {
    if (!this.shouldAvoidLeftCutoutForButtons()) {
      this.leftCutoutInsetVp = 0;
      return;
    }

    const mainWin = getMainWindowCached();
    if (!mainWin) {
      this.leftCutoutInsetVp = 0;
      return;
    }

    try {
      const cutoutArea = mainWin.getWindowAvoidArea(window.AvoidAreaType.TYPE_CUTOUT);
      const leftInsetPx: number = cutoutArea.leftRect.width;
      this.leftCutoutInsetVp = leftInsetPx > 0 ? Math.ceil(px2vp(leftInsetPx)) + CUTOUT_BUTTON_GUTTER_VP : 0;
    } catch (_e) {
      this.leftCutoutInsetVp = 0;
    }
  }

  // Centralized layout update for area/window changes.
  private recalcLayout(widthVp: number, heightVp: number): void {
    if (widthVp <= 0 || heightVp <= 0) {
      return;
    }

    // 宽屏下手动竖屏布局自动复位（切换按钮同时被禁用）：应用形态只服从宽屏 responsive 决策。
    if (this.lrLayoutForced && !this.isNarrowViewport(widthVp, heightVp)) {
      this.lrLayoutForced = false;
      this.restoreLandscapeAfterManualLayout = false;
      this.landscapeOrientationPending = false;
    }

    const layoutScene: WindowScene = this.getLayoutScene(widthVp, heightVp);
    const decision = decideLayout({
      widthVp,
      heightVp,
      scene: layoutScene,
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
    let nextUseCustomGameSize: boolean = decision.useCustomGameSize !== false;

    const isPureFloatingScene: boolean = this.isPureGameFloatingWindow(widthVp, heightVp);
    // Tiny floating windows should stay pure game canvas.
    if (isPureFloatingScene) {
      nextMode = HostMode.COMPACT;
      nextFit = isPureFloatingScene ? 'width' : 'height';
      nextFitLocked = true;
      nextShowSideButtons = false;
      nextShowBottomTools = false;
      nextGameWidthVp = widthVp;
      nextGameHeightVp = heightVp;
      nextGameLeftMarginVp = 0;
      nextSidebarWidthVp = 0;
      nextUseCustomGameSize = false;
    }

    // 用户手动触发的"游戏 + 底部面板"布局：仅在全屏/全景多窗场景下生效（分屏场景下
    // responsive 已根据屏幕形态自动选择，无需覆盖）。游戏按宽度等比缩放置顶，
    // 余下空间分配给底部面板；保留 ButtonColumn 以便用户再次切换。
    if (this.lrLayoutForced && layoutScene === WindowScene.FULLSCREEN) {
      const contentH: number = Math.min(heightVp, widthVp / GAME_ASPECT_RATIO);
      nextMode = HostMode.EXPANDED;
      nextFit = 'width';
      nextFitLocked = false;
      nextShowSideButtons = true;
      nextShowBottomTools = true;
      nextGameWidthVp = widthVp;
      nextGameHeightVp = Math.floor(contentH);
      nextGameLeftMarginVp = 0;
      nextSidebarWidthVp = 0;
      nextUseCustomGameSize = true;
    }

    if (nextUseCustomGameSize) {
      const gameSizePercent: number = nextMode === HostMode.COMPACT
        ? this.compactGameSizePercent
        : this.expandedGameSizePercent;
      const gameViewport: GameViewportBox = resolveGameViewportBox(
        nextGameWidthVp,
        nextGameHeightVp,
        gameSizePercent,
      );
      nextGameWidthVp = gameViewport.widthVp;
      nextGameHeightVp = gameViewport.heightVp;
      nextGameLeftMarginVp = gameViewport.leftMarginVp;
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

    const landscapeOnly: boolean = this.shouldUseLandscapeOnlyRotation();
    void this.host.applyOrientationByMode(
      this.mode === HostMode.COMPACT,
      this.shouldUsePortraitOnlyRotation(),
      landscapeOnly
    );
    if (this.landscapeOrientationPending && (widthVp > heightVp || !this.isToolSurfaceScene())) {
      this.landscapeOrientationPending = false;
    }
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
      this.fullReloadUrl = homeOverride;
    } else {
      this.fullReloadUrl = this.HOME;
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
        { text: '继续进击', color: '#e53935' },
        { text: '撤退', color: '#6A9AB5' },
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

  private applyPendingLogout(): void {
    if (this.logoutRevision <= this.handledLogoutRevision) {
      return;
    }
    this.handledLogoutRevision = this.logoutRevision;
    this.firstPageLoad = false;
    this.controller.loadUrl(this.HOME);
  }

  private applyWebAudioMuteState(muted?: boolean): void {
    const nextMuted = muted ?? (AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED) ?? false);
    this.host.setWebAudioMuted(nextMuted);
  }

  private refreshBattlePreviewState(): void {
    const available: boolean = isInBattle();
    if (!available) {
      this.battlePreviewAvailable = false;
      this.battlePreviewVisible = true;
      this.updateBattlePreviewAutoOverlay();
      return;
    }
    if (!this.battlePreviewAvailable) {
      this.battlePreviewVisible = true;
      this.battlePreviewAutoOverlaySuppressed = false;
    }
    this.battlePreviewAvailable = true;
    this.updateBattlePreviewAutoOverlay();
  }

  private toggleBattlePreview(): void {
    if (!this.battlePreviewAvailable) {
      return;
    }
    this.battlePreviewVisible = !this.battlePreviewVisible;
  }

  private toggleFloatOverlayPanel(): void {
    if (this.isFloatOverlayVisible()) {
      this.closeFloatOverlayPanel();
      return;
    }
    this.overlayForced = true;
    this.battlePreviewAutoOverlayActive = false;
  }

  private closeFloatOverlayPanel(): void {
    if (this.battlePreviewAutoOverlayActive ||
      (this.battlePreviewAvailable && this.shouldAvoidLeftCutoutForButtons())) {
      this.battlePreviewAutoOverlaySuppressed = true;
      this.battlePreviewAutoOverlayActive = false;
    }
    this.overlayForced = false;
  }

  private updateBattlePreviewAutoOverlay(): void {
    if (!this.autoBattlePreviewFloatOverlay) {
      if (this.battlePreviewAutoOverlayActive) {
        this.overlayForced = false;
      }
      this.battlePreviewAutoOverlayActive = false;
      this.battlePreviewAutoOverlaySuppressed = false;
      return;
    }

    if (!this.battlePreviewAvailable) {
      if (this.battlePreviewAutoOverlayActive) {
        this.overlayForced = false;
      }
      this.battlePreviewAutoOverlayActive = false;
      this.battlePreviewAutoOverlaySuppressed = false;
      return;
    }

    const shouldAutoOpen: boolean = this.shouldAvoidLeftCutoutForButtons() &&
      this.panelConfig.mode !== PanelMode.BottomPanel;
    if (!shouldAutoOpen) {
      if (this.battlePreviewAutoOverlayActive) {
        this.overlayForced = false;
      }
      this.battlePreviewAutoOverlayActive = false;
      return;
    }

    if (!this.overlayForced && !this.battlePreviewAutoOverlaySuppressed) {
      this.overlayForced = true;
      this.battlePreviewAutoOverlayActive = true;
    }
  }

  private isFloatOverlayVisible(): boolean {
    if (!this.overlayForced || this.panelConfig.mode === PanelMode.BottomPanel) {
      return false;
    }
    return !this.battlePreviewAutoOverlayActive || this.autoBattlePreviewFloatOverlay;
  }

  aboutToAppear() {
    const ctx = getContext(this) as common.UIAbilityContext;
    this.host = new WebHostController(this.controller, ctx, this.getFit, this.getInjectOptions, (r: string) => this.rpcHandler(r));
    this.host.setAdvanceWarningHandler((msg: string) => { this.showAdvanceWarningDialog(msg); });
    this.unregisterPageVisible = registerWebHostPageVisibleHandler(() => {
      this.restoreVisibleWindowState(true);
      this.applyWebAudioMuteState();
    });
    this.unsubAppVolumeMuted = subscribeAppVolumeMuted((muted: boolean) => {
      this.applyWebAudioMuteState(muted);
    });
    void syncAppVolumeMuted().then((muted: boolean) => {
      this.applyWebAudioMuteState(muted);
    }).catch(() => {
      this.applyWebAudioMuteState(false);
    });
    this.unsubSortieStartTaiha = subscribeAlert<SortieStartTaihaAlert>('sortie_start_taiha', (a) => {
      this.showSortieStartTaihaDialog(a);
    });
    this.refreshBattlePreviewState();
    this.unsubGameState = subscribeGameState((changeType, _state) => {
      if (changeType === 'battle' || changeType === 'all') {
        this.refreshBattlePreviewState();
      }
    });
    this.host.bindDisplay();
    void this.host.applyOrientationByMode(true, this.shouldUsePortraitOnlyRotation(), false);
    void this.loadRuntimeConfig();
    this.applyPendingLogout();

    const mainWin = getMainWindowCached();
    this.restoreVisibleWindowState(false);
    if (mainWin) {
      // Keep scene in sync when entering split-screen or floating window.
      this.windowStatusCb = (nextStatus: window.WindowStatusType) => {
        this.scene = this.resolveScene(nextStatus);
        this.applyGameWindowChrome(mainWin);
        this.scheduleGameWindowChromeRefresh(mainWin);
        this.refreshLeftCutoutInset();
        this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
        this.updateBattlePreviewAutoOverlay();
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

    if (this.unsubGameState) {
      this.unsubGameState();
      this.unsubGameState = undefined;
    }

    if (this.unsubAppVolumeMuted) {
      this.unsubAppVolumeMuted();
      this.unsubAppVolumeMuted = undefined;
    }

    if (this.unregisterPageVisible) {
      this.unregisterPageVisible();
      this.unregisterPageVisible = undefined;
    }

    if (this.windowStatusCb) {
      const mainWin = getMainWindowCached();
      if (mainWin) {
        mainWin.off('windowStatusChange', this.windowStatusCb);
      }
    }
    if (this.chromeRefreshTimer >= 0) {
      clearTimeout(this.chromeRefreshTimer);
      this.chromeRefreshTimer = -1;
    }
  }

  private buildFullReloadUrl(): string {
    const baseUrl: string = this.fullReloadUrl || this.HOME;
    const marker: string = `hmFullReload=${Date.now().toString()}`;
    const hashIndex: number = baseUrl.indexOf('#');
    if (hashIndex >= 0) {
      const withoutHash: string = baseUrl.slice(0, hashIndex);
      const hash: string = baseUrl.slice(hashIndex + 1);
      if (hash.length > 0) {
        return `${withoutHash}#${hash}&${marker}`;
      }
      return `${withoutHash}#${marker}`;
    }
    return `${baseUrl}#${marker}`;
  }

  private reloadFullPage(): void {
    this.firstPageLoad = false;
    try {
      this.controller.runJavaScript?.("try{sessionStorage.removeItem('__hm_promote_last_v2');}catch(e){}");
    } catch (_e) {}
    this.controller.loadUrl(this.buildFullReloadUrl());
  }

  private promptRefresh(): void {
    promptAction.showDialog({
      title: '刷新网页',
      message: '请选择刷新方式。',
      buttons: [
        { text: '取消', color: '#888888' },
        { text: '框架刷新', color: '#6A9AB5' },
        { text: '页面刷新(F5)', color: '#e53935' },
      ],
    }).then((result) => {
      if (result.index === 1) {
        this.controller.refresh();
      } else if (result.index === 2) {
        this.reloadFullPage();
      }
    }).catch((_e: Error) => {});
  }

  private onWebAttached = () => {
    this.host.attach();
    this.applyWebAudioMuteState();
  }
  private onBegin = () => {
    this.progress = 5;
    this.host.onPageBegin();
    this.applyWebAudioMuteState();
  }
  private onProg = (p: number) => { this.progress = p; }
  private onEnd = () => {
    this.progress = 100;
    this.host.onPageEnd();
    this.applyWebAudioMuteState();
    void this.host.applyOrientationByMode(
      this.mode === HostMode.COMPACT,
      this.shouldUsePortraitOnlyRotation(),
      this.shouldUseLandscapeOnlyRotation()
    );

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
    if (this.shouldAvoidTopSafeArea()) {
      return [SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END];
    }
    // Fullscreen and floating: expand all edges for true edge-to-edge layout.
    return [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END];
  }

  private shouldAvoidTopSafeArea(): boolean {
    return this.scene === WindowScene.FULLSCREEN &&
      this.viewportHeightVp > this.viewportWidthVp &&
      this.viewportWidthVp <= NARROW_SHORT_SIDE_VP;
  }

  private shouldAvoidLeftCutoutForButtons(): boolean {
    return this.scene === WindowScene.FULLSCREEN &&
      this.viewportWidthVp > this.viewportHeightVp &&
      this.viewportHeightVp <= NARROW_SHORT_SIDE_VP;
  }

  private getLeftButtonCutoutInsetVp(): number {
    return this.shouldAvoidLeftCutoutForButtons() ? this.leftCutoutInsetVp : 0;
  }

  private getLeftButtonRailWidthVp(): number {
    return LEFT_BUTTON_COLUMN_WIDTH_VP + this.getLeftButtonCutoutInsetVp();
  }

  private getFloatingButtonColumnHeightVp(): number {
    if (this.viewportHeightVp <= 0) {
      return LEFT_BUTTON_COLUMN_FULL_HEIGHT_VP;
    }
    const availableHeight = Math.max(LEFT_BUTTON_COLUMN_WIDTH_VP, this.viewportHeightVp - FLOATING_BATTLE_STATS_RESERVED_HEIGHT_VP);
    return Math.min(LEFT_BUTTON_COLUMN_FULL_HEIGHT_VP, availableHeight);
  }

  private getFloatOverlayLeftDismissWidthVp(): number {
    return Math.max(PanelDimens.overlaySideGap, this.getLeftButtonRailWidthVp());
  }

  private shouldUsePortraitOnlyRotation(): boolean {
    return this.lrLayoutForced && this.isToolSurfaceScene();
  }

  private isNarrowLandscapeToolSurface(): boolean {
    return this.isToolSurfaceScene() &&
      this.viewportWidthVp > this.viewportHeightVp &&
      this.viewportHeightVp <= NARROW_SHORT_SIDE_VP;
  }

  private shouldUseLandscapeOnlyRotation(): boolean {
    if (this.shouldUsePortraitOnlyRotation() || !this.isToolSurfaceScene()) {
      return false;
    }
    if (this.landscapeOrientationPending) {
      return true;
    }
    return this.mode === HostMode.COMPACT && this.isNarrowLandscapeToolSurface();
  }

  private isNarrowViewport(
    widthVp: number = this.viewportWidthVp,
    heightVp: number = this.viewportHeightVp
  ): boolean {
    return Math.min(widthVp, heightVp) <= NARROW_SHORT_SIDE_VP;
  }

  private canToggleLrLayout(): boolean {
    // 宽屏（短边超过窄屏阈值）不提供手动横/竖切换：应用形态只服从宽屏 responsive 决策。
    if (!this.isNarrowViewport()) {
      return false;
    }
    if (this.scene === WindowScene.SPLIT) {
      return false;
    }
    if (this.scene === WindowScene.FULLSCREEN &&
      this.mode === HostMode.EXPANDED &&
      !this.lrLayoutForced) {
      return false;
    }
    return true;
  }

  /**
   * 切换"游戏 + 底部面板"布局：
   *  - 打开时由 Orientation 先推一次竖屏再应用竖屏策略，避免旋转锁定时等待传感器触发
   *  - 关闭后由 recalcLayout → applyOrientationByMode 恢复正常方向策略
   */
  private toggleLrLayout(): void {
    if (!this.canToggleLrLayout()) {
      return;
    }
    const nextForced: boolean = !this.lrLayoutForced;
    if (nextForced) {
      this.restoreLandscapeAfterManualLayout = this.isNarrowLandscapeToolSurface();
      this.landscapeOrientationPending = false;
    } else {
      this.landscapeOrientationPending = this.restoreLandscapeAfterManualLayout && this.isToolSurfaceScene();
      this.restoreLandscapeAfterManualLayout = false;
    }
    this.lrLayoutForced = nextForced;
    this.recalcLayout(this.viewportWidthVp, this.viewportHeightVp);
  }

  private shouldShowFloatingButtons(): boolean {
    if (!this.isToolSurfaceScene()) {
      return false;
    }
    if (!this.showSideButtons) {
      return false;
    }
    // 底部面板模式下，按钮改为面板上方的横向按钮栏，避免与浮动按钮列重复。
    if (this.panelConfig.mode === PanelMode.BottomPanel) {
      return false;
    }
    return this.mode === HostMode.COMPACT ||
      this.panelConfig.mode !== PanelMode.FloatOverlay ||
      this.overlayForced;
  }

  build() {
    // Outer Stack: wraps the entire host so the Ship info overlay can cover every
    // child of WebHost (game area, button bar, bottom panel) — not just the game
    // sub-Stack. WebHost itself remains mounted so the WebView/controller survive.
    Stack({ alignContent: Alignment.TopStart }) {
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
              resourceCacheEnabled: this.resourceCacheEnabled,
              resourceCacheAudioEnabled: this.resourceCacheAudioEnabled,
              onWebAttached: this.onWebAttached,
              onWebPageBegin: this.onBegin,
              onWebProgress: this.onProg,
              onWebPageEnd: this.onEnd
            })
          }
          .width(this.getGameViewportWidth())
          .height(this.getGameViewportHeight())
          .clip(true)
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Top)
        .backgroundColor('#000')

        // Unified floating controls (fullscreen and panorama multi-window):
        // - COMPACT tool surfaces: always show
        // - non-COMPACT tool surfaces: mirror the original side-button visibility condition
        // Portrait split and tiny floating windows are intentionally hidden.
        if (this.shouldShowFloatingButtons()) {
          // 左下角纵向排列：ButtonColumn 在上，战果在下
          Column() {
            ButtonColumn({
              onRefresh: () => this.promptRefresh(),
              onToggleLrMode: () => this.toggleLrLayout(),
              onTogglePanel: () => this.toggleFloatOverlayPanel(),
              onToggleBattlePreview: () => this.toggleBattlePreview(),
              onOpenShipInfo: () => { this.shipInfoVisible = true; },
              onOpenEquipInfo: () => { this.equipInfoVisible = true; },
              onOpenRemodelInfo: () => { this.remodelInfoVisible = true; },
              onOpenExpeditionInfo: () => { this.expeditionInfoVisible = true; },
              lrMode: this.lrLayoutForced ? 'portraitFit' : 'landscapeWithDashboard',
              rotateEnabled: this.canToggleLrLayout(),
              panelActive: this.isFloatOverlayVisible(),
              battlePreviewAvailable: this.battlePreviewAvailable,
              battlePreviewVisible: this.battlePreviewVisible,
            })
              .width(LEFT_BUTTON_COLUMN_WIDTH_VP)
              .height(this.getFloatingButtonColumnHeightVp())
            BattleStatsWidget()
              .margin({ left: 4, bottom: 6 })
          }
          .width(this.getLeftButtonRailWidthVp())
          .padding({ left: this.getLeftButtonCutoutInsetVp() })
          .align(Alignment.BottomStart)
          .alignItems(HorizontalAlign.Start)
          .onClick(() => {})
          .zIndex(2)
        }

        // Fleet status sidebar — right-side persistent status bar.
        // Conditions mirror shouldShowFloatingButtons: side buttons + tool surface only.
        // Use absolute position to anchor to the right edge of the Stack (align() only
        // sets internal content alignment and does NOT reposition within the parent).
        if (this.showSidebarPref && this.sidebarWidthVp > 0 && this.shouldShowFloatingButtons()) {
          FleetStatusSidebar({
            sidebarWidth: this.sidebarWidthVp,
            showAvatar: this.showSidebarAvatarPref,
          })
            .width(this.sidebarWidthVp)
            .height('100%')
            .align(Alignment.TopEnd)
            .position({ x: this.viewportWidthVp - this.sidebarWidthVp, y: 0 })
        }

        // FloatOverlay panel — overlaid on the game viewport.
        // Only shown when explicitly triggered (overlayForced / fairy ball event).
        // Side margins act as dismiss areas; tapping outside panel hides it.
        if (this.isFloatOverlayVisible()) {
          Row() {
            Column()
              .width(this.getFloatOverlayLeftDismissWidthVp())
              .height('100%')
              .backgroundColor(Color.Transparent)
              .onClick(() => this.closeFloatOverlayPanel())
            PanelHost({
              config: { mode: PanelMode.FloatOverlay, bottomPanelHeight: 0 },
              showBattlePreview: this.battlePreviewVisible
            })
              .layoutWeight(1)
              .height('100%')
            Column()
              .width(PanelDimens.overlaySideGap)
              .height('100%')
              .backgroundColor(Color.Transparent)
              .onClick(() => this.closeFloatOverlayPanel())
          }
          .width('100%')
          .height('100%')
          .zIndex(1)
        }
      }
      .height(this.showBottomTools ? this.gameHeightVp : '100%')
      .constraintSize(this.showBottomTools ? { minHeight: this.gameHeightVp, maxHeight: this.gameHeightVp } : {})
      .layoutWeight(this.showBottomTools ? 0 : 1)
      .width('100%')

      // Bottom panel — rendered in EXPANDED mode beneath the game.
      // Layout splits by viewport orientation:
      //   portrait  → 横向按钮栏在游戏与 panel 之间，panel 占满下方
      //   landscape → 纵向按钮栏贴左侧，与 panel 并排位于游戏画面下方
      // Each branch wraps its children in a single Container so the parent
      // Column flex always sees one weighted slot here.
      if (this.panelConfig.mode === PanelMode.BottomPanel) {
        if (this.viewportWidthVp > this.viewportHeightVp) {
          Row() {
            Column() {
              ButtonColumn({
                onRefresh: () => this.promptRefresh(),
                onToggleLrMode: () => this.toggleLrLayout(),
                onTogglePanel: () => this.toggleFloatOverlayPanel(),
                onToggleBattlePreview: () => this.toggleBattlePreview(),
                onOpenShipInfo: () => { this.shipInfoVisible = true; },
                onOpenEquipInfo: () => { this.equipInfoVisible = true; },
                onOpenRemodelInfo: () => { this.remodelInfoVisible = true; },
                onOpenExpeditionInfo: () => { this.expeditionInfoVisible = true; },
                lrMode: this.lrLayoutForced ? 'portraitFit' : 'landscapeWithDashboard',
                rotateEnabled: this.canToggleLrLayout(),
                panelActive: this.isFloatOverlayVisible(),
                showPanelToggle: false,
                battlePreviewAvailable: this.battlePreviewAvailable,
                battlePreviewVisible: this.battlePreviewVisible,
              })
              .height('100%')
            }
            .width(this.getLeftButtonRailWidthVp())
            .height('100%')
            .padding({ left: this.getLeftButtonCutoutInsetVp() })
            .backgroundColor('#0f1118')
            .alignItems(HorizontalAlign.Start)
            .justifyContent(FlexAlign.Start)

            PanelHost({ config: this.panelConfig, showBattlePreview: this.battlePreviewVisible })
              .layoutWeight(1)
              .height('100%')
          }
          .width('100%')
          .layoutWeight(1)
          .alignItems(VerticalAlign.Top)
        } else {
          Column() {
            ButtonRow({
              onRefresh: () => this.promptRefresh(),
              onToggleLrMode: () => this.toggleLrLayout(),
              onTogglePanel: () => this.toggleFloatOverlayPanel(),
              onToggleBattlePreview: () => this.toggleBattlePreview(),
              onOpenShipInfo: () => { this.shipInfoVisible = true; },
              onOpenEquipInfo: () => { this.equipInfoVisible = true; },
              onOpenRemodelInfo: () => { this.remodelInfoVisible = true; },
              onOpenExpeditionInfo: () => { this.expeditionInfoVisible = true; },
              lrMode: this.lrLayoutForced ? 'portraitFit' : 'landscapeWithDashboard',
              rotateEnabled: this.canToggleLrLayout(),
              panelActive: this.isFloatOverlayVisible(),
              showPanelToggle: false,
              battlePreviewAvailable: this.battlePreviewAvailable,
              battlePreviewVisible: this.battlePreviewVisible,
            })
            PanelHost({ config: this.panelConfig, showBattlePreview: this.battlePreviewVisible })
              .width('100%')
              .layoutWeight(1)
          }
          .width('100%')
          .layoutWeight(1)
        }
      }
    }
    .height('100%')
    .width('100%')
    .backgroundColor('#000')
    .onAreaChange((_oldArea: Area, area: Area) => {
      const w: number = lengthToNumber(area.width);
      const h: number = lengthToNumber(area.height);
      this.viewportWidthVp = w;
      this.viewportHeightVp = h;
      const mainWin = getMainWindowCached();
      if (mainWin) {
        this.refreshSceneAndChrome(mainWin);
        this.scheduleGameWindowChromeRefresh(mainWin);
      }
      this.refreshLeftCutoutInset();
      this.recalcLayout(w, h);
      this.updateBattlePreviewAutoOverlay();
    })

      // Info overlays — cover the entire WebHost area (game + button bar +
      // bottom panel) regardless of layout mode. Rendered as siblings of the
      // root Column inside the outer Stack so the WebviewController and game
      // session stay mounted underneath; closing returns to the live game.
      if (this.shipInfoVisible) {
        ShipInfoPage({
          onClose: () => { this.shipInfoVisible = false; },
        })
          .width('100%')
          .height('100%')
      }
      if (this.equipInfoVisible) {
        EquipInfoPage({
          onClose: () => { this.equipInfoVisible = false; },
        })
          .width('100%')
          .height('100%')
      }
      if (this.remodelInfoVisible) {
        RemodelInfoPage({
          onClose: () => { this.remodelInfoVisible = false; },
        })
          .width('100%')
          .height('100%')
      }
      if (this.expeditionInfoVisible) {
        ExpeditionInfoPage({
          onClose: () => { this.expeditionInfoVisible = false; },
        })
          .width('100%')
          .height('100%')
      }
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM], this.getSafeAreaEdges())
  }
}
