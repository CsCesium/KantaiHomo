/**
 * 横向按钮栏：位于游戏画面下方、底部面板上方。
 * 内容与 ButtonColumn 一致（刷新 / 横竖切换 / 面板开关 / 登出），
 * 仅排列方向改为水平，便于在 BottomPanel 模式下嵌入到 game 与 panel 之间。
 */
@ComponentV2
export default struct ButtonRow {
  @Event onRefresh: () => void;
  @Event onToggleLrMode: () => void;
  @Event onTogglePanel: () => void;
  @Event onToggleBattlePreview: () => void;
  @Event onLogout: () => void;
  @Event onOpenShipInfo: () => void;
  @Param lrMode: 'portraitFit' | 'landscapeWithDashboard' = 'landscapeWithDashboard';
  @Param panelActive: boolean = false;
  @Param showPanelToggle: boolean = true;
  @Param battlePreviewAvailable: boolean = false;
  @Param battlePreviewVisible: boolean = false;

  @Builder private IconBtn(txt: string, onTap: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Text(txt).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#999')
    }
    .width(48).height(40)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(onTap)
  }

  @Builder private PanelBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Text('面')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.panelActive ? '#56d8e0' : '#999')
    }
    .width(48).height(40)
    .backgroundColor(this.panelActive ? '#1c3535' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onTogglePanel?.())
  }

  @Builder private BattlePreviewBtn() {
    Button({ type: ButtonType.Normal, stateEffect: this.battlePreviewAvailable }) {
      Text(!this.battlePreviewAvailable ? '战' : (this.battlePreviewVisible ? '主' : '战'))
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor(!this.battlePreviewAvailable ? '#444' : (this.battlePreviewVisible ? '#C8B99A' : '#56d8e0'))
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
      Text('信').fontSize(18).fontWeight(FontWeight.Medium).fontColor('#999')
    }
    .width(48).height(40)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .bindMenu([
      { value: '舰娘', action: () => this.onOpenShipInfo?.() },
    ])
  }

  @Builder private LogoutBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Text('↩')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor('#e57373')
    }
    .width(48).height(40)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onLogout?.())
  }

  build() {
    Row() {
      Row({ space: 8 }) {
        this.IconBtn('⟳', () => this.onRefresh?.())
        this.IconBtn(this.lrMode === 'portraitFit' ? '竖' : '横', () => this.onToggleLrMode?.())
        if (this.showPanelToggle) {
          this.PanelBtn()
        }
        this.BattlePreviewBtn()
        this.InfoBtn()
        this.LogoutBtn()
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
