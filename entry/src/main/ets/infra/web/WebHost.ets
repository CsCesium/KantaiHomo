import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetString, kvSet } from "../storage/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, HostMode, ViewScene } from "./layout/responsive";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { window } from "@kit.ArkUI";
import ButtonColumn from "./components/ButtonColumn";
import GameWeb from "./components/GameWeb";
import { lengthToNumber } from "../utils/trans";

interface RpcPayload {
  op: string;
  key?: string;
  value?: string;
  def?: string;
}

@Entry
@Component
export default struct WebHost {
  private controller: webview.WebviewController = new webview.WebviewController();
  private host!: WebHostController;

  private readonly HOME: string = HOME_URL;
  private readonly COMPACT_GUTTER = 30;
  private readonly LR_SPLIT_MODE_KEY = 'layout.wide_lr_dashboard';
  @State private progress: number = 0;
  @State private mode: HostMode = HostMode.COMPACT;
  @State private scene: ViewScene = ViewScene.NARROW;
  @State private lastMode: HostMode | null = null;
  @State private fit: FitPolicy = 'height';
  @State private showBottomTools: boolean = false;
  @State private showFixedButtons: boolean = false;
  @State private allowWideSplitModeSwitch: boolean = false;
  @State private preferWideLrDashboard: boolean = false;
  @State private gameHeightVp: number = 0;
  @State private gameWidthVp: number = 0;

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
    locked: this.mode === HostMode.COMPACT,
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

  aboutToAppear() {
    const ctx = getContext(this) as common.UIAbilityContext;
    this.host = new WebHostController(this.controller, ctx, this.getFit, this.getInjectOptions, (r: string) => this.rpcHandler(r));
    this.host.bindDisplay();
    void this.host.applyOrientationByMode(true);

    window.getLastWindow(ctx).then(win => {
      void win.setWindowLayoutFullScreen(true);
      void win.setWindowSystemBarEnable([]);
    });

    webview.WebviewController.setWebDebuggingAccess(true);//Chrome DevTool debug
    void this.restoreLayoutPreference();
  }

  aboutToDisappear() {
    this.host.unbindDisplay();
  }

  private onWebAttached = () => { this.host.attach(); }
  private onBegin = () => { this.progress = 5; this.host.onPageBegin(); }
  private onProg = (p: number) => { this.progress = p; }
  private onEnd = () => {
    this.progress = 100;
    this.host.onPageEnd();
    void this.host.applyOrientationByMode(this.mode === HostMode.COMPACT);
  }

  private async restoreLayoutPreference(): Promise<void> {
    const raw = await kvGetString(this.LR_SPLIT_MODE_KEY, '0');
    this.preferWideLrDashboard = raw === '1';
  }

  private async toggleWideLrMode(): Promise<void> {
    const next: boolean = !this.preferWideLrDashboard;
    this.preferWideLrDashboard = next;
    await kvSet(this.LR_SPLIT_MODE_KEY, next ? '1' : '0');
  }

  private isFloatingWindowStatus(): boolean {
    try {
      const dynamicWinStatus = window.WindowStatusType as Record<string, number>;
      const floatingVal = dynamicWinStatus.FLOATING;
      const splitVal = dynamicWinStatus.SPLIT_SCREEN;
      if (floatingVal !== undefined) {
        return this.host.getWindowStatus() === floatingVal;
      }
      if (splitVal !== undefined) {
        return this.host.getWindowStatus() !== splitVal && this.host.getWindowStatus() !== window.WindowStatusType.FULL_SCREEN;
      }
    } catch (_) {
    }
    return false;
  }

  build() {
    Column() {
      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress }).width('100%').height(2).backgroundColor('#222')
      }

      Row() {
        ButtonColumn({ onRefresh: () => this.controller.refresh() })
          .width(this.showFixedButtons ? 56 : 0)
          .visibility(this.showFixedButtons ? Visibility.Visible : Visibility.None)
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
        .margin({left:(this.showFixedButtons ? this.COMPACT_GUTTER : 0)})
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
        if (this.allowWideSplitModeSwitch) {
          Button(this.preferWideLrDashboard ? '左右分屏：横向占满+Dashboard' : '左右分屏：竖向占满') {
            Text(this.preferWideLrDashboard ? '切换到竖向占满' : '切换到横向占满+Dashboard')
              .fontSize(14)
          }
          .height(40)
          .margin({ left: 12 })
          .onClick(() => {
            void this.toggleWideLrMode();
          })
        }
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
      const decision = decideLayout({
        widthVp: w,
        heightVp: h,
        isFloating: this.isFloatingWindowStatus(),
        preferWideLrDashboard: this.preferWideLrDashboard
      });
      const modeChanged: boolean = this.lastMode !== decision.mode;

      this.mode = decision.mode;
      this.fit = decision.policy;
      this.scene = decision.scene;
      this.showBottomTools = decision.showBottomTools;
      this.showFixedButtons = decision.showFixedButtons;
      this.allowWideSplitModeSwitch = decision.allowWideSplitModeSwitch;

      const AR: number = 720 / 1200; // H/W
      const contentH: number = Math.min(h, w * AR);
      this.gameWidthVp = w;
      if (this.scene === ViewScene.WIDE_LEFT_RIGHT && this.showBottomTools) {
        this.gameHeightVp = Math.floor(contentH);
      } else {
        this.gameHeightVp = h;
      }

      void this.host.applyOrientationByMode(this.mode === HostMode.COMPACT);
      if (modeChanged) {
        this.host.onPageEnd();
      }
      this.lastMode = this.mode;
    })
  }
}
