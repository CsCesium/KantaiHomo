import { BusinessError } from '@kit.BasicServicesKit';
import { vibrator } from '@kit.SensorServiceKit';
import { FairyService } from '../service/FairyService';

/**
 * The draggable floating ball rendered inside the fairy SubWindow.
 *
 * Gesture mapping:
 *   Pan              → moves the SubWindow via FairyService.moveTo()
 *                      snaps to nearest edge on release
 *   Double-tap       → TODO: toggle tool menu (reserved)
 *   Single-tap       → signals main window to open Dashboard
 *   Long-press 3 s   → hides the ball with haptic feedback
 *
 * Single/double-tap disambiguation: a 220 ms timer delays the single-tap
 * action so a arriving double-tap can cancel it first.
 *
 * Position management is entirely handled by FairyService (px coordinates).
 * This component never positions itself — it always fills its SubWindow.
 */
@Component
export struct FairyBall {
  // Drag state: window position (px) at gesture start
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  // Single-tap debounce timer handle
  private singleTapTimer: number = -1;

  @State private pressing: boolean = false;

  // ── helpers ───────────────────────────────────────────────────────────────

  private doHide(): void {
    vibrator.startVibration(
      { type: 'preset', effectId: 'haptic.clock.timer', count: 1 },
      { id: 0, usage: 'alarm' },
      (_err: BusinessError) => {}
    );
    void FairyService.getInstance().savePosition();
    void FairyService.getInstance().hide();
  }

  // ── build ─────────────────────────────────────────────────────────────────

  build() {
    Stack({ alignContent: Alignment.Center }) {
      // Ball body
      Circle()
        .width('100%')
        .height('100%')
        .fill('#808080')
        .opacity(this.pressing ? 0.85 : 0.55)

      // App icon
      Image($r('app.media.icon'))
        .width('65%')
        .height('65%')
        .objectFit(ImageFit.Contain)
        .opacity(0.9)
    }
    .width('100%')
    .height('100%')
    // Track press state for visual feedback
    .onTouch((event: TouchEvent) => {
      this.pressing =
        event.type === TouchType.Down || event.type === TouchType.Move;
    })
    .gesture(
      GestureGroup(GestureMode.Exclusive,

        // ── Drag ──────────────────────────────────────────────────────────
        PanGesture()
          .onActionStart((_event: GestureEvent) => {
            const pos = FairyService.getInstance().getPositionPx();
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;
          })
          .onActionUpdate((event: GestureEvent) => {
            // event.offsetX/Y are accumulated vp offsets from gesture start
            void FairyService.getInstance().moveTo(
              this.dragStartX + vp2px(event.offsetX),
              this.dragStartY + vp2px(event.offsetY),
            );
          })
          .onActionEnd((_event: GestureEvent) => {
            void FairyService.getInstance().snapToEdge();
          }),

        // ── Long press → hide ─────────────────────────────────────────────
        LongPressGesture({ duration: 3000 })
          .onAction((_event: GestureEvent) => {
            this.doHide();
          }),

        // ── Double-tap → toggle menu (reserved) ───────────────────────────
        TapGesture({ count: 2 })
          .onAction((_event: GestureEvent) => {
            // Cancel the pending single-tap action
            if (this.singleTapTimer !== -1) {
              clearTimeout(this.singleTapTimer);
              this.singleTapTimer = -1;
            }
            // TODO: expand/collapse tool menu
          }),

        // ── Single-tap → open Dashboard ───────────────────────────────────
        TapGesture({ count: 1 })
          .onAction((_event: GestureEvent) => {
            if (this.singleTapTimer !== -1) {
              clearTimeout(this.singleTapTimer);
            }
            // Delay so an incoming double-tap can cancel this first
            this.singleTapTimer = setTimeout(() => {
              this.singleTapTimer = -1;
              FairyService.getInstance().requestOpenDashboard();
            }, 220);
          }),
      )
    )
  }
}
