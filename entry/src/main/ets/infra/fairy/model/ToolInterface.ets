import { CustomAnimation } from "./CustomAnimation";
import { CustomParams } from "./CustomParams";

export interface ToolInterface {
  // 静态参数
  params?: CustomParams;
  // 动效参数
  animation?: CustomAnimation;
}