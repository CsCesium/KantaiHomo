import settings from '@ohos.settings';
import common from '@ohos.app.ability.common';
import window from '@ohos.window';


export class Orientation {
  private ctx: common.UIAbilityContext;
  private current: window.Orientation = window.Orientation.AUTO_ROTATION;
  private currentIsCompact: boolean = false;
  private rotationUnlocked: boolean = true;
  // 记录锁定时的方向
  private lockedOrientation: window.Orientation | null = null;

  constructor(ctx: common.UIAbilityContext) {
    this.ctx = ctx;
    this.rotationUnlocked = this.readSystemRotationStatus();
    this.registerRotationObserver();
    console.debug('[Orientation] init, rotationUnlocked:', this.rotationUnlocked);
  }

  /**
   * 注册系统旋转设置监听
   */
  private registerRotationObserver(): void {
    try {
      settings.registerKeyObserver(
        this.ctx,
        settings.general.ACCELEROMETER_ROTATION_STATUS,
        settings.domainName.DEVICE_SHARED,
        () => {
          let value = settings.getValueSync(this.ctx, settings.general.ACCELEROMETER_ROTATION_STATUS, "1");
          const unlocked = (value === "1" );
          console.debug('[Orientation] observer triggered, value:', value, 'unlocked:', unlocked);
          if (this.rotationUnlocked !== unlocked) {
            this.rotationUnlocked = unlocked;
            console.debug('[Orientation] system rotation changed:', unlocked ? 'unlocked' : 'locked');
            this.onRotationLockChanged(unlocked);
          }
        }
      );
      console.debug('[Orientation] observer registered');
    } catch (e) {
      console.error('[Orientation] registerObserver failed:', e);
    }
  }

  /**
   * 旋转锁定状态变化时处理
   */
  private async onRotationLockChanged(unlocked: boolean): Promise<void> {
    if (unlocked) {
      // 解锁：清除锁定方向，恢复自动旋转
      this.lockedOrientation = null;
      await this.applyByMode(this.currentIsCompact);
    } else {
      // 锁定：记录并锁定当前方向
      const currentOri = await this.getCurrentLockedOrientation();
      this.lockedOrientation = currentOri;
      console.debug('[Orientation] locking to:', currentOri);
      await this.forceSetOrientation(currentOri);
    }
  }

  /**
   * 销毁时取消监听
   */
  destroy(): void {
    try {
      settings.unregisterKeyObserver(
        this.ctx,
        settings.general.ACCELEROMETER_ROTATION_STATUS,
        settings.domainName.DEVICE_SHARED
      );
    } catch (e) {
      console.error('[Orientation] unregisterObserver failed:', e);
    }
  }

  /**
   * 强制设置方向（忽略缓存检查）
   */
  private async forceSetOrientation(ori: window.Orientation): Promise<void> {
    try {
      const win = await window.getLastWindow(this.ctx);
      await win.setPreferredOrientation(ori);
      this.current = ori;
      console.debug('[Orientation] force set to:', ori);
    } catch (e) {
      console.error('[Orientation] forceSetOrientation failed:', e);
    }
  }

  async setPreferred(ori: window.Orientation): Promise<void> {
    // 如果系统旋转锁定，拒绝切换到 AUTO 类型的方向
    if (!this.rotationUnlocked && this.isAutoRotationType(ori)) {
      console.debug('[Orientation] blocked auto rotation due to system lock');
      return;
    }

    if (this.current === ori) { return; }
    const win = await window.getLastWindow(this.ctx);
    await win.setPreferredOrientation(ori);
    this.current = ori;
    console.debug('[Orientation] setPreferred:', ori);
  }

  async applyByMode(isCompact: boolean): Promise<void> {
    this.currentIsCompact = isCompact;
    console.debug('[Orientation] applyByMode, isCompact:', isCompact, 'rotationUnlocked:', this.rotationUnlocked);

    // 如果系统旋转锁定，使用锁定的方向
    if (!this.rotationUnlocked) {
      if (this.lockedOrientation !== null) {
        await this.forceSetOrientation(this.lockedOrientation);
      } else {
        // 首次锁定，获取当前方向
        const lockedOri = await this.getCurrentLockedOrientation();
        this.lockedOrientation = lockedOri;
        await this.forceSetOrientation(lockedOri);
      }
      return;
    }

    const ori: window.Orientation = isCompact
      ? window.Orientation.AUTO_ROTATION_LANDSCAPE
      : window.Orientation.AUTO_ROTATION;
    await this.setPreferred(ori);
  }

  /**
   * 判断是否是自动旋转类型
   */
  private isAutoRotationType(ori: window.Orientation): boolean {
    return ori === window.Orientation.AUTO_ROTATION ||
      ori === window.Orientation.AUTO_ROTATION_LANDSCAPE ||
      ori === window.Orientation.AUTO_ROTATION_PORTRAIT;
  }

  /**
   * 获取当前窗口方向，转换为锁定方向
   */
  private async getCurrentLockedOrientation(): Promise<window.Orientation> {
    try {
      const win = await window.getLastWindow(this.ctx);
      const props = win.getWindowProperties();
      const rect = props.windowRect;
      // 根据宽高判断当前是横屏还是竖屏
      const isLandscape = rect.width > rect.height;
      const ori = isLandscape
        ? window.Orientation.LANDSCAPE
        : window.Orientation.PORTRAIT;
      console.debug('[Orientation] getCurrentLocked, rect:', rect.width, 'x', rect.height, '-> ', ori);
      return ori;
    } catch (e) {
      console.error('[Orientation] getCurrentLockedOrientation failed:', e);
      return window.Orientation.LANDSCAPE;
    }
  }

  /**
   * 读取系统旋转设置
   */
  private readSystemRotationStatus(): boolean {
    try {
      const val = settings.getValueSync(this.ctx, settings.general.ACCELEROMETER_ROTATION_STATUS, "1");
      console.debug('[Orientation] readSystemRotationStatus:', val);
      return (val === "1");
    } catch (e) {
      console.error('[Orientation] readSystemRotationStatus failed:', e);
      return true;
    }
  }

  isSystemRotationUnlocked(): boolean {
    return this.rotationUnlocked;
  }
}