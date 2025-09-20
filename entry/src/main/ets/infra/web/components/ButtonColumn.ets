@ComponentV2
export default struct LeftButtonColumn {
  @Event onRefresh: () => void;

  @Builder private IconBtn(txt: string, onTap: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: true }) {
      Text(txt).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#999')
    }
    .width(48).height(48)
    .backgroundColor(Color.Transparent)
    .border({ width: 0 })
    .onClick(onTap)
  }

  build() {
    Column({ space: 8 }) {
      this.IconBtn('⟳',  () => this.onRefresh?.())
      this.IconBtn('⟳',  () => this.onRefresh?.())
      // TODO：Other Buttons
    }
    .width(56).padding({ left: 4, right: 4, top: 8, bottom: 8 })
  }
}