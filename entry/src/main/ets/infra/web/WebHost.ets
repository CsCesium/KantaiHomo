import { webview } from "@kit.ArkWeb";
import { kvDelete, kvGetString, kvSet } from "../store/kv";
import { HOME_URL } from "./config";
import { FitGetter, WebHostController } from "./controller/WebHostController";
import { decideLayout, FitPolicy, HostMode } from "./layout/responsive";
import { defaultInjectOptions, InjectOptions } from "./types";
import { common } from "@kit.AbilityKit";
import { window } from "@kit.ArkUI";
import ButtonColumn from "./components/ButtonColumn";
import GameWeb from "./components/GameWeb";
import { lengthToNumber } from "../utils/TransUtil";

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
  @State private progress: number = 0;
  @State private mode: HostMode = HostMode.COMPACT;
  @State private lastMode: HostMode | null = null;
  @State private fit: FitPolicy = 'height';
  @State private showBottomTools: boolean = false;
  @State private gameHeightVp: number = 0;

  private getInjectOptions = (): Required<InjectOptions> => {
    return {
      channelName: 'hmos',
      postMethod: 'post',
      //apiFilter: '/\\/kcsapi\\//',
      apiFilter: '/.*/',//debug

      enableXHRHook: true,
      enableFetchHook: true,
      enableFPS: defaultInjectOptions.enableFPS,
      enableTouchPatch: defaultInjectOptions.enableTouchPatch,
      enableTickerRAF: defaultInjectOptions.enableTickerRAF,
      enablePixiPatch: defaultInjectOptions.enablePixiPatch,
      enableSessionPersist: defaultInjectOptions.enableSessionPersist,
      enableIframeFit: defaultInjectOptions.enableIframeFit,
      enableYasenDetect: defaultInjectOptions.enableYasenDetect,
    };
  };

  private getFit = (): FitGetter => ({
    policy: this.fit,
    locked: this.mode === HostMode.COMPACT
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

    webview.WebviewController.setWebDebuggingAccess(true);//debug
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

  build() {
    Column() {
      if (this.progress > 0 && this.progress < 100) {
        Progress({ value: this.progress }).width('100%').height(2).backgroundColor('#222')
      }

      Row() {
        ButtonColumn({ onRefresh: () => this.controller.refresh() })
          .width(this.mode === HostMode.COMPACT ? 56 : 0)
          .visibility(this.mode === HostMode.COMPACT ? Visibility.Visible : Visibility.None)
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
            // 若你在 GameWeb 中暴露 onMessage，可在此转给 host.onPostMessage(raw)
          })
        }
        .margin({left:(this.showBottomTools?0:this.COMPACT_GUTTER)})
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
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
    .onAreaChange((_, area) => {
      const w: number = lengthToNumber(area.width);
      const h: number = lengthToNumber(area.height);
      const decision = decideLayout(w, h);
      const modeChanged: boolean = this.lastMode !== decision.mode;

      this.mode = decision.mode;
      this.fit = decision.policy;
      this.showBottomTools = (this.mode === HostMode.EXPANDED);

      const AR: number = 720 / 1200; // H/W
      const contentH: number = Math.min(h, w * AR);
      this.gameHeightVp = this.showBottomTools ? Math.floor(contentH) : h;

      void this.host.applyOrientationByMode(this.mode === HostMode.COMPACT);
      if (modeChanged) {
        this.host.onPageEnd();
      }
      this.lastMode = this.mode;
    })
  }
}
