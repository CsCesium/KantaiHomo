import { CustomAnimation } from "./CustomAnimation";
import { CustomParams } from "./CustomParams";

@Observed
export class AttributeSet {

  // 动效参数
  private animation_?: CustomAnimation;
  // 静态参数
  private params_?: CustomParams;

  constructor(animation?: CustomAnimation, params?: CustomParams) {
    this.animation_ = animation;
    this.params_ = params;
  }

  get animation(): CustomAnimation | undefined {
    return this.animation_;
  }

  set animation(animation: CustomAnimation | undefined) {
    this.animation_ = animation;
  }

  get params(): CustomParams | undefined {
    return this.params_;
  }
}