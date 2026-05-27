/**
 * 横向按钮栏：位于游戏画面下方、底部面板上方。
 * 内容与 ButtonColumn 一致（刷新 / 横竖切换 / 面板开关 / 静音），
 * 仅排列方向改为水平，便于在 BottomPanel 模式下嵌入到 game 与 panel 之间。
 */
import {
  APP_STORAGE_APP_VOLUME_MUTED,
  setAppVolumeMuted,
  syncAppVolumeMuted
} from '../../audio/appVolume';

@ComponentV2
export default struct ButtonRow {
  @Event onRefresh: () => void;
  @Event onToggleLrMode: () => void;
  @Event onTogglePanel: () => void;
  @Event onToggleBattlePreview: () => void;
  @Event onOpenShipInfo: () => void;
  @Event onOpenEquipInfo: () => void;
  @Event onOpenExpeditionInfo: () => void;
  @Param lrMode: 'portraitFit' | 'landscapeWithDashboard' = 'landscapeWithDashboard';
  @Param panelActive: boolean = false;
  @Param showPanelToggle: boolean = true;
  @Param battlePreviewAvailable: boolean = false;
  @Param battlePreviewVisible: boolean = false;
  @Local appVolumeMuted: boolean = false;

  aboutToAppear(): void {
    this.refreshMuteState();
  }

  private refreshMuteState(): void {
    const muted = AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED);
    this.appVolumeMuted = muted !== undefined ? muted : false;
    void syncAppVolumeMuted().then((nextMuted: boolean) => {
      this.appVolumeMuted = nextMuted;
    }).catch(() => {
      this.appVolumeMuted = false;
    });
  }

  private toggleAppVolumeMuted(): void {
    const next = !this.appVolumeMuted;
    this.appVolumeMuted = next;
    void setAppVolumeMuted(next).then((muted: boolean) => {
      this.appVolumeMuted = muted;
    }).catch(() => {
      this.refreshMuteState();
    });
  }

  @Builder private RefreshBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph($r('sys.symbol.arrow_clockwise'))
        .fontSize(22)
        .fontColor(['#999'])
    }
    .width(48).height(40)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onRefresh?.())
  }

  @Builder private RotateBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph(this.lrMode === 'portraitFit'
        ? $r('sys.symbol.rectangle_portrait_rotate')
        : $r('sys.symbol.rectangle_rotate'))
        .fontSize(22)
        .fontColor(['#999'])
    }
    .width(48).height(40)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onToggleLrMode?.())
  }

  @Builder private PanelBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph($r('sys.symbol.rectangle_on_rectangle'))
        .fontSize(22)
        .fontColor([this.panelActive ? '#56d8e0' : '#999'])
    }
    .width(48).height(40)
    .backgroundColor(this.panelActive ? '#1c3535' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onTogglePanel?.())
  }

  @Builder private BattlePreviewBtn() {
    Button({ type: ButtonType.Normal, stateEffect: this.battlePreviewAvailable }) {
      SymbolGlyph(this.battlePreviewAvailable && this.battlePreviewVisible
        ? $r('sys.symbol.house')
        : $r('sys.symbol.scope'))
        .fontSize(22)
        .fontColor([!this.battlePreviewAvailable ? '#444' : (this.battlePreviewVisible ? '#C8B99A' : '#56d8e0')])
    }
    .width(48).height(40)
    .backgroundColor(this.battlePreviewAvailable && this.battlePreviewVisible ? '#2a2a20' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => {
      if (this.battlePreviewAvailable) {
        this.onToggleBattlePreview?.();
      }
    })
  }

  @Builder private InfoBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph($r('sys.symbol.list_bullet'))
        .fontSize(22)
        .fontColor(['#999'])
    }
    .width(48).height(40)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .bindMenu([
      { value: '舰娘', action: () => this.onOpenShipInfo?.() },
      { value: '装备', action: () => this.onOpenEquipInfo?.() },
      { value: '远征', action: () => this.onOpenExpeditionInfo?.() },
    ])
  }

  @Builder private MuteBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph(this.appVolumeMuted ? $r('sys.symbol.speaker_slash') : $r('sys.symbol.speaker'))
        .fontSize(22)
        .fontColor([this.appVolumeMuted ? '#e57373' : '#999'])
    }
    .width(48).height(40)
    .backgroundColor(this.appVolumeMuted ? '#351c1c' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.toggleAppVolumeMuted())
  }

  build() {
    Row() {
      Row({ space: 8 }) {
        this.RefreshBtn()
        this.RotateBtn()
        if (this.showPanelToggle) {
          this.PanelBtn()
        }
        this.BattlePreviewBtn()
        this.InfoBtn()
        this.MuteBtn()
      }
      .height(40)
      .padding({ left: 8, right: 8 })
      .backgroundColor('#0f1118')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(40)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
  }
}
