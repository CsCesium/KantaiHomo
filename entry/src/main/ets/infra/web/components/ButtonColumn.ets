import {
  APP_STORAGE_APP_VOLUME_MUTED,
  setAppVolumeMuted,
  syncAppVolumeMuted
} from '../../audio/appVolume';

@ComponentV2
export default struct LeftButtonColumn {
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
    .width(48).height(48)
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
    .width(48).height(48)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onToggleLrMode?.())
  }

  // Panel toggle button — highlighted when overlay is active.
  @Builder private PanelBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph($r('sys.symbol.rectangle_on_rectangle'))
        .fontSize(22)
        .fontColor([this.panelActive ? '#56d8e0' : '#999'])
    }
    .width(48).height(48)
    .backgroundColor(this.panelActive ? '#1c3535' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onTogglePanel?.())
  }

  @Builder private BattlePreviewBtn() {
    Button({ type: ButtonType.Normal, stateEffect: this.battlePreviewAvailable }) {
      SymbolGlyph(this.battlePreviewAvailable && this.battlePreviewVisible
        ? $r('sys.symbol.scope'):$r('sys.symbol.house'))
        .fontSize(22)
        .fontColor([!this.battlePreviewAvailable ? '#444' : (this.battlePreviewVisible ? '#C8B99A' : '#56d8e0')])
    }
    .width(48).height(48)
    .backgroundColor(this.battlePreviewAvailable && this.battlePreviewVisible ? '#2a2a20' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => {
      if (this.battlePreviewAvailable) {
        this.onToggleBattlePreview?.();
      }
    })
  }

  // Info button — opens a sub-menu of in-app info pages (ship list, etc.).
  // Each menu item triggers an overlay that preserves the game WebView.
  @Builder private InfoBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph($r('sys.symbol.list_bullet'))
        .fontSize(22)
        .fontColor(['#999'])
    }
    .width(48).height(48)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .bindMenu([
      { value: '舰娘', action: () => this.onOpenShipInfo?.() },
      { value: '装备', action: () => this.onOpenEquipInfo?.() },
      { value: '远征', action: () => this.onOpenExpeditionInfo?.() },
    ])
  }

  // Mute button — red tint when audio is muted.
  @Builder private MuteBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      SymbolGlyph(this.appVolumeMuted ? $r('sys.symbol.speaker_slash') : $r('sys.symbol.speaker'))
        .fontSize(22)
        .fontColor([this.appVolumeMuted ? '#e57373' : '#999'])
    }
    .width(48).height(48)
    .backgroundColor(this.appVolumeMuted ? '#351c1c' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.toggleAppVolumeMuted())
  }

  build() {
    Scroll() {
      Column({ space: 8 }) {
        this.RefreshBtn()
        this.RotateBtn()
        if (this.showPanelToggle) {
          this.PanelBtn()
        }
        this.BattlePreviewBtn()
        this.MuteBtn()
        this.InfoBtn()
      }
      .width(56)
      .padding({ left: 4, right: 4, top: 8, bottom: 8 })
    }
    .width(56)
    .scrollable(ScrollDirection.Vertical)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
  }
}
