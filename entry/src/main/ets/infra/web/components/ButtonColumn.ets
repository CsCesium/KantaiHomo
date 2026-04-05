@ComponentV2
export default struct LeftButtonColumn {
  @Event onRefresh: () => void;
  @Event onToggleLrMode: () => void;
  @Event onTogglePanel: () => void;
  @Param lrMode: 'portraitFit' | 'landscapeWithDashboard' = 'landscapeWithDashboard';
  @Param panelActive: boolean = false;

  @Builder private IconBtn(txt: string, onTap: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Text(txt).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#999')
    }
    .width(48).height(48)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(onTap)
  }

  // Panel toggle button — highlighted when overlay is active.
  @Builder private PanelBtn() {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Text('面')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.panelActive ? '#56d8e0' : '#999')
    }
    .width(48).height(48)
    .backgroundColor(this.panelActive ? '#1c3535' : Color.Transparent)
    .border({ width: 0 })
    .onClick(() => this.onTogglePanel?.())
  }

  build() {
    Column({ space: 8 }) {
      this.IconBtn('⟳',  () => this.onRefresh?.())
      this.IconBtn(this.lrMode === 'portraitFit' ? '竖' : '横', () => this.onToggleLrMode?.())
      this.PanelBtn()
      // TODO：Other Buttons
    }
    .width(56).padding({ left: 4, right: 4, top: 8, bottom: 8 })
  }
}
