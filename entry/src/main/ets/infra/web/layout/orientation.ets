import settings from '@ohos.settings';
import common from '@ohos.app.ability.common';
import window from '@ohos.window';



export class Orientation {
  private ctx: common.UIAbilityContext;
  private current: window.Orientation = window.Orientation.AUTO_ROTATION;

  constructor(ctx: common.UIAbilityContext) { this.ctx = ctx; }

  async setPreferred(ori: window.Orientation): Promise<void> {
    if (this.current === ori) { return; }
    const win = await window.getLastWindow(this.ctx);
    await win.setPreferredOrientation(ori);
    this.current = ori;
  }

  async applyByMode(isCompact: boolean): Promise<void> {
    const ori: window.Orientation = isCompact
      ? window.Orientation.AUTO_ROTATION_LANDSCAPE
      : window.Orientation.AUTO_ROTATION;
    if (!this.isSystemRotationUnlocked()) {
      return;
    }
    await this.setPreferred(ori);
  }

  isSystemRotationUnlocked(): boolean {
    const val = settings.getValueSync(this.ctx,settings.general.ACCELEROMETER_ROTATION_STATUS, "1");
    return (val === "1");
  }
}