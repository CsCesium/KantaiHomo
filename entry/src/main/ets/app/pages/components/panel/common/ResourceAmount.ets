import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';

@ComponentV2
export default struct ResourceAmount {
  @Param icon: string = '';
  @Param label: string = '';
  @Param value: number = 0;
  @Param gain: number = 0;
  @Param textColor: string = PanelColors.txtMuted;
  @Param iconSize: number = 12;

  @Builder
  private GainText(): void {
    if (this.gain > 0) {
      Text(`+${this.gain}`)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.hpOk)
        .margin({ left: 1 })
    }
  }

  build() {
    Row({ space: 2 }) {
      if (this.icon.length > 0) {
        Image(this.icon)
          .width(this.iconSize)
          .height(this.iconSize)
          .objectFit(ImageFit.Contain)
      } else if (this.label.length > 0) {
        Text(this.label)
          .fontSize(PanelDimens.fontSm)
          .fontColor(this.textColor)
      }

      Text(`${this.value}`)
        .fontSize(PanelDimens.fontSm)
        .fontColor(this.textColor)
        .maxLines(1)

      this.GainText()
    }
    .alignItems(VerticalAlign.Center)
  }
}
