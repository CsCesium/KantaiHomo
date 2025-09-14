import ButtonColumn from "./ButtonColumn";

@ComponentV2
export default struct ExpandedToolArea {
  @Event onRefresh: () => void = () => {};

  build() {
    Row() {
      ButtonColumn({ onRefresh: this.onRefresh })
      //TODO: Tool area for future functions
      Blank().layoutWeight(1)
    }
    .height(96).width('100%').backgroundColor('#0b0b0b')
  }
}