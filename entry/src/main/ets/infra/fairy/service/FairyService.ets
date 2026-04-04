import window from '@ohos.window';
import { display } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { kvGetNumber, kvSet } from '../../storage/kv';

const TAG = 'FairyService';
const FAIRY_WIN_NAME = 'kantaiHomoFairy';
const KV_POS_X = 'fairy.pos.x';
const KV_POS_Y = 'fairy.pos.y';

/** Ball size in vp — keep in sync with FairyBall component */
export const FAIRY_BALL_VP = 56;

/**
 * Singleton that owns the fairy SubWindow lifecycle.
 *
 * Init flow (called from Entry.onWindowStageCreate):
 *   FairyService.getInstance().init(windowStage)
 *
 * The SubWindow loads infra/fairy/page/FairyPage as its content.
 * FairyPage/FairyBall communicate back through this service (same JS runtime).
 *
 * AppStorage keys exposed to observers in the main window:
 *   'fairy.visible'        boolean  — whether the ball is shown
 *   'fairy.openDashboard'  number   — timestamp, bump to request dashboard open
 */
export class FairyService {
  // ── singleton ────────────────────────────────────────────────────────────
  private static inst: FairyService | null = null;

  static getInstance(): FairyService {
    if (!FairyService.inst) {
      FairyService.inst = new FairyService();
    }
    return FairyService.inst;
  }

  // ── state ─────────────────────────────────────────────────────────────────
  private subWin: window.Window | null = null;
  private posXPx: number = 0;
  private posYPx: number = 0;
  private alive: boolean = false;

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Create the SubWindow and show the fairy ball.
   * Must be called from onWindowStageCreate with the active WindowStage.
   */
  async init(stage: window.WindowStage): Promise<void> {
    const d = display.getDefaultDisplaySync();
    const ballPx = Math.round(vp2px(FAIRY_BALL_VP));

    // Restore saved position, default to right edge 1/3 from top.
    this.posXPx = await kvGetNumber(KV_POS_X, d.width - ballPx - Math.round(vp2px(16)));
    this.posYPx = await kvGetNumber(KV_POS_Y, Math.round(d.height / 3));

    try {
      this.subWin = await stage.createSubWindow(FAIRY_WIN_NAME);

      // Load the ArkUI page before showing the window.
      await this.subWin.setUIContent('infra/fairy/page/FairyPage');
      this.subWin.setWindowBackgroundColor('#00000000');

      await this.subWin.resize(ballPx, ballPx);
      await this.subWin.moveWindowTo(this.posXPx, this.posYPx);
      await this.subWin.showWindow();

      this.alive = true;
      AppStorage.setOrCreate<boolean>('fairy.visible', true);
      hilog.info(0x1357, TAG, 'SubWindow ready at (%{public}d, %{public}d)', this.posXPx, this.posYPx);
    } catch (e) {
      hilog.error(0x1357, TAG, 'init failed: %{public}s', String(e));
    }
  }

  /**
   * Move the ball to an absolute screen position (px).
   * Called by FairyBall on every PanGesture update.
   */
  async moveTo(xPx: number, yPx: number): Promise<void> {
    if (!this.subWin || !this.alive) {
      return;
    }
    const d = display.getDefaultDisplaySync();
    const ballPx = Math.round(vp2px(FAIRY_BALL_VP));
    const x = Math.max(0, Math.min(Math.round(xPx), d.width - ballPx));
    const y = Math.max(0, Math.min(Math.round(yPx), d.height - ballPx));
    this.posXPx = x;
    this.posYPx = y;
    try {
      await this.subWin.moveWindowTo(x, y);
    } catch (e) {
      hilog.error(0x1357, TAG, 'moveTo failed: %{public}s', String(e));
    }
  }

  /**
   * Snap the ball to the nearest horizontal edge.
   * Call this at the end of a drag gesture.
   */
  async snapToEdge(): Promise<void> {
    const d = display.getDefaultDisplaySync();
    const ballPx = Math.round(vp2px(FAIRY_BALL_VP));
    const snapX = (this.posXPx + ballPx / 2 < d.width / 2) ? 0 : (d.width - ballPx);
    await this.moveTo(snapX, this.posYPx);
    await this.savePosition();
  }

  /** Persist current position to KV store. */
  async savePosition(): Promise<void> {
    await kvSet(KV_POS_X, this.posXPx);
    await kvSet(KV_POS_Y, this.posYPx);
  }

  /** Current ball position in physical pixels. */
  getPositionPx(): { x: number; y: number } {
    return { x: this.posXPx, y: this.posYPx };
  }

  /** Hide the SubWindow without destroying it. */
  async hide(): Promise<void> {
    if (!this.subWin || !this.alive) {
      return;
    }
    try {
      await this.subWin.hide();
      AppStorage.set<boolean>('fairy.visible', false);
    } catch (e) {
      hilog.error(0x1357, TAG, 'hide failed: %{public}s', String(e));
    }
  }

  /** Re-show the SubWindow after hide(). */
  async show(): Promise<void> {
    if (!this.subWin || !this.alive) {
      return;
    }
    try {
      await this.subWin.showWindow();
      AppStorage.set<boolean>('fairy.visible', true);
    } catch (e) {
      hilog.error(0x1357, TAG, 'show failed: %{public}s', String(e));
    }
  }

  /** Whether the ball is currently visible. */
  isVisible(): boolean {
    return AppStorage.get<boolean>('fairy.visible') ?? true;
  }

  /**
   * Signal the main window to open the Dashboard.
   * Observers watch 'fairy.openDashboard' in AppStorage.
   */
  requestOpenDashboard(): void {
    AppStorage.set<number>('fairy.openDashboard', Date.now());
  }

  /** Destroy the SubWindow on ability teardown. */
  async destroy(): Promise<void> {
    if (!this.subWin) {
      return;
    }
    try {
      await this.subWin.destroyWindow();
    } catch (e) {
      hilog.error(0x1357, TAG, 'destroy failed: %{public}s', String(e));
    }
    this.subWin = null;
    this.alive = false;
  }
}
