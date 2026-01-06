import { CustomAnimation } from "./CustomAnimation";
import { CustomParams } from "./CustomParams";
import { ToolInterface } from "./ToolInterface";

@Component
export struct ChildTool {

  // UI
  builder?: WrappedBuilder<[ToolInterface]>;
  // 静态参数
  params?: CustomParams;
  // 动效参数
  @ObjectLink animationAttribute: CustomAnimation;

  build() {
    Column() {
      this.builder!.builder({params: this.params, animation: this.animationAttribute});
    }
  }
}