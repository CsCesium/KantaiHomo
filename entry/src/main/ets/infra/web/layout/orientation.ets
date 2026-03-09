import settings from '@ohos.settings';
import common from '@ohos.app.ability.common';
import window from '@ohos.window';
import display from '@ohos.display';

export class Orientation {
  private ctx: common.UIAbilityContext;

  private current: window.Orientation = window.Orientation.AUTO_ROTATION;
  private currentIsCompact: boolean = false;
  private rotationUnlocked: boolean = true;
  private lockedOrientation: window.Orientation | null = null;

  private foldStatus: display.FoldStatus = display.FoldStatus.FOLD_STATUS_UNKNOWN;
  private windowStatus: window.WindowStatusType = window.WindowStatusType.FULL_SCREEN;

  private readonly onFoldStatusChange = (status: display.FoldStatus): void => {
    this.foldStatus = status;
    console.debug('[Orientation] foldStatus changed:', status);
    void this.applyByMode(this.currentIsCompact);
  };

  private readonly onWindowStatusChange = (status: window.WindowStatusType): void => {
    this.windowStatus = status;
    console.debug('[Orientation] windowStatus changed:', status);
    void this.applyByMode(this.currentIsCompact);
  };

  constructor(ctx: common.UIAbilityContext) {
    this.ctx = ctx;
    this.rotationUnlocked = this.readSystemRotationStatus();
    this.foldStatus = this.readFoldStatus();
    this.registerRotationObserver();
    this.registerFoldObserver();
    void this.registerWindowStatusObserver();
  }

  destroy(): void {
    try {
      settings.unregisterKeyObserver(
        this.ctx,
        settings.general.ACCELEROMETER_ROTATION_STATUS,
        settings.domainName.DEVICE_SHARED
      );
    } catch (e) {
      console.error('[Orientation] unregister rotation observer failed:', e);
    }

    try {
      if (display.isFoldable()) {
        display.off('foldStatusChange');
      }
    } catch (e) {
      console.error('[Orientation] unregister fold observer failed:', e);
    }

    void this.unregisterWindowStatusObserver();
  }

  private registerRotationObserver(): void {
    try {
      settings.registerKeyObserver(
        this.ctx,
        settings.general.ACCELEROMETER_ROTATION_STATUS,
        settings.domainName.DEVICE_SHARED,
        () => {
          const value = settings.getValueSync(
            this.ctx,
            settings.general.ACCELEROMETER_ROTATION_STATUS,
            '1'
          );
          const unlocked = (value === '1');
          console.debug('[Orientation] rotation observer triggered, value:', value, 'unlocked:', unlocked);

          if (this.rotationUnlocked !== unlocked) {
            this.rotationUnlocked = unlocked;
            void this.onRotationLockChanged(unlocked);
          }
        }
      );
      console.debug('[Orientation] rotation observer registered');
    } catch (e) {
      console.error('[Orientation] register rotation observer failed:', e);
    }
  }

  private registerFoldObserver(): void {
    try {
      if (!display.isFoldable()) {
        console.debug('[Orientation] current device is not foldable');
        return;
      }
      display.on('foldStatusChange', this.onFoldStatusChange);
      console.debug('[Orientation] fold observer registered');
    } catch (e) {
      console.error('[Orientation] register fold observer failed:', e);
    }
  }

  private async registerWindowStatusObserver(): Promise<void> {
    try {
      const win = await window.getLastWindow(this.ctx);
      this.windowStatus = this.safeGetWindowStatus(win);
      win.on('windowStatusChange', this.onWindowStatusChange);
      console.debug('[Orientation] windowStatus observer registered, initial:', this.windowStatus);
    } catch (e) {
      console.error('[Orientation] register windowStatus observer failed:', e);
    }
  }

  private async unregisterWindowStatusObserver(): Promise<void> {
    try {
      const win = await window.getLastWindow(this.ctx);
      win.off('windowStatusChange');
    } catch (e) {
      console.error('[Orientation] unregister windowStatus observer failed:', e);
    }
  }

  private async onRotationLockChanged(unlocked: boolean): Promise<void> {
    console.debug('[Orientation] system rotation changed:', unlocked ? 'unlocked' : 'locked');

    if (unlocked) {
      this.lockedOrientation = null;
      await this.applyByMode(this.currentIsCompact);
      return;
    }

    await this.refreshWindowStatus();
    if (this.shouldForceLandscape()) {
      if (unlocked) {
        this.lockedOrientation = null;
        await this.setPreferred(window.Orientation.AUTO_ROTATION_LANDSCAPE);
      } else {
        this.lockedOrientation = window.Orientation.LANDSCAPE;
        await this.forceSetOrientation(window.Orientation.LANDSCAPE);
      }
      return;
    }

    const currentOri = await this.getCurrentLockedOrientation();
    this.lockedOrientation = currentOri;
    await this.forceSetOrientation(currentOri);
  }

  async applyByMode(isCompact: boolean): Promise<void> {
    this.currentIsCompact = isCompact;
    await this.refreshWindowStatus();

    console.debug(
      '[Orientation] applyByMode:',
      'isCompact=', isCompact,
      'rotationUnlocked=', this.rotationUnlocked,
      'foldStatus=', this.foldStatus,
      'windowStatus=', this.windowStatus
    );

    // 1) 只有 “compact + 折叠态 + 全屏” 才强制横屏
    if (this.shouldForceLandscape()) {
      if (this.rotationUnlocked) {
        this.lockedOrientation = null;
        await this.setPreferred(window.Orientation.AUTO_ROTATION_LANDSCAPE);
      } else {
        this.lockedOrientation = window.Orientation.LANDSCAPE;
        await this.forceSetOrientation(window.Orientation.LANDSCAPE);
      }
      return;
    }

    if (!this.isFullscreenWindow()) {
      await this.applyNormalPolicy();
      return;
    }

    await this.applyNormalPolicy();
  }

  private async applyNormalPolicy(): Promise<void> {
    if (!this.rotationUnlocked) {
      const lockedOri = await this.getCurrentLockedOrientation();
      this.lockedOrientation = lockedOri;
      await this.forceSetOrientation(lockedOri);
      return;
    }

    this.lockedOrientation = null;
    await this.setPreferred(window.Orientation.AUTO_ROTATION);
  }

  private shouldForceLandscape(): boolean {
    return this.currentIsCompact && this.isFolded() && this.isFullscreenWindow();
  }

  private isFolded(): boolean {
    if (!display.isFoldable()) {
      return false;
    }
    return this.foldStatus === display.FoldStatus.FOLD_STATUS_FOLDED;
  }

  private isFullscreenWindow(): boolean {
    // 手机/折叠屏主窗口通常判断 FULL_SCREEN 就够用
    return this.windowStatus === window.WindowStatusType.FULL_SCREEN;
  }

  private async refreshWindowStatus(): Promise<void> {
    try {
      const win = await window.getLastWindow(this.ctx);
      this.windowStatus = this.safeGetWindowStatus(win);
    } catch (e) {
      console.error('[Orientation] refreshWindowStatus failed:', e);
    }
  }

  private safeGetWindowStatus(win: window.Window): window.WindowStatusType {
    try {
      return win.getWindowStatus();
    } catch (e) {
      console.error('[Orientation] getWindowStatus failed, fallback FULL_SCREEN:', e);
      return window.WindowStatusType.FULL_SCREEN;
    }
  }

  private readFoldStatus(): display.FoldStatus {
    try {
      if (!display.isFoldable()) {
        return display.FoldStatus.FOLD_STATUS_UNKNOWN;
      }
      return display.getFoldStatus();
    } catch (e) {
      console.error('[Orientation] readFoldStatus failed:', e);
      return display.FoldStatus.FOLD_STATUS_UNKNOWN;
    }
  }

  private async forceSetOrientation(ori: window.Orientation): Promise<void> {
    try {
      if (this.current === ori) {
        return;
      }
      const win = await window.getLastWindow(this.ctx);
      await win.setPreferredOrientation(ori);
      this.current = ori;
      console.debug('[Orientation] force set to:', ori);
    } catch (e) {
      console.error('[Orientation] forceSetOrientation failed:', e);
    }
  }

  async setPreferred(ori: window.Orientation): Promise<void> {
    try {
      if (this.current === ori) {
        return;
      }
      const win = await window.getLastWindow(this.ctx);
      await win.setPreferredOrientation(ori);
      this.current = ori;
      console.debug('[Orientation] setPreferred:', ori);
    } catch (e) {
      console.error('[Orientation] setPreferred failed:', e);
    }
  }

  private async getCurrentLockedOrientation(): Promise<window.Orientation> {
    try {
      const win = await window.getLastWindow(this.ctx);
      const props = win.getWindowProperties();
      const rect = props.windowRect;

      const isLandscape = rect.width > rect.height;
      const ori = isLandscape
        ? window.Orientation.LANDSCAPE
        : window.Orientation.PORTRAIT;

      console.debug(
        '[Orientation] getCurrentLockedOrientation:',
        rect.width, 'x', rect.height, '->', ori
      );
      return ori;
    } catch (e) {
      console.error('[Orientation] getCurrentLockedOrientation failed:', e);
      return window.Orientation.PORTRAIT;
    }
  }

  private readSystemRotationStatus(): boolean {
    try {
      const val = settings.getValueSync(
        this.ctx,
        settings.general.ACCELEROMETER_ROTATION_STATUS,
        '1'
      );
      console.debug('[Orientation] readSystemRotationStatus:', val);
      return val === '1';
    } catch (e) {
      console.error('[Orientation] readSystemRotationStatus failed:', e);
      return true;
    }
  }

  isSystemRotationUnlocked(): boolean {
    return this.rotationUnlocked;
  }
}