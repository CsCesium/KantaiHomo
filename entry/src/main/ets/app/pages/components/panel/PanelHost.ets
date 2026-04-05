import { PanelLayoutConfig, PanelMode } from '../../../../features/panel/type';
import BottomPanel from './overlay/BottomPanel';
import FloatOverlayPanel from './bottom/FloatOverlayPanel';

/**
 * Panel host — dispatches to the correct panel variant based on layout config.
 * Positioning relative to the game viewport is handled by the parent (WebHost).
 *
 *   BottomPanel  → full-width panel docked below game area  (EXPANDED mode)
 *   FloatOverlay → semi-transparent panel overlaid on game  (COMPACT mode)
 *   Hidden       → nothing rendered
 */
@ComponentV2
export default struct PanelHost {
  @Param config: PanelLayoutConfig = { mode: PanelMode.Hidden, bottomPanelHeight: 0 };

  build() {
    Column() {
      if (this.config.mode === PanelMode.BottomPanel) {
        BottomPanel({ panelHeight: this.config.bottomPanelHeight })
      } else if (this.config.mode === PanelMode.FloatOverlay) {
        FloatOverlayPanel()
      }
    }
    .width('100%')
    .height('100%')
  }
}
