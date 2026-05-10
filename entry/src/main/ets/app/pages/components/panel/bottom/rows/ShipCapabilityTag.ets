@ComponentV2
export default struct ShipCapabilityTag {
  @Param label: string = '';

  @Computed
  get bgColor(): string {
    if (this.label === '対空CI') return '#66306078';
    if (this.label === '夜戦CI') return '#665d4820';
    return '#66505a18';
  }

  @Computed
  get fgColor(): string {
    if (this.label === '対空CI') return '#aee8ff';
    if (this.label === '夜戦CI') return '#ffd18a';
    return '#ffd86b';
  }

  build() {
    Text(this.label)
      .fontSize(6)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.fgColor)
      .backgroundColor(this.bgColor)
      .padding({ left: 3, right: 3, top: 0, bottom: 0 })
      .borderRadius(2)
      .constraintSize({ maxWidth: 58 })
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
  }
}
