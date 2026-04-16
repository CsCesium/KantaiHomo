import { PanelLayoutConfig, PanelMode } from '../../../../features/panel/type';
import { subscribeGameState, isInBattle, hasBattleResult } from '../../../../features/state';
import BottomPanel from './overlay/BottomPanel';
import FloatOverlayPanel from './bottom/FloatOverlayPanel';
import BattlePreviewPanel from './battle/BattlePreviewPanel';

/**
 * Panel host — dispatches to the correct panel variant.
 *
 * Battle state takes priority: when a sortie battle is in progress
 * (prediction computed or result received), BattlePreviewPanel is shown
 * in place of the normal fleet panel.  The transition back happens
 * automatically when the battle state is cleared after the sortie ends.
 *
 * Normal layout dispatch:
 *   BottomPanel  → full-width panel docked below game area  (EXPANDED mode)
 *   FloatOverlay → semi-transparent panel overlaid on game  (COMPACT mode)
 *   Hidden       → nothing rendered
 */
@ComponentV2
export default struct PanelHost {
  @Param config: PanelLayoutConfig = { mode: PanelMode.Hidden, bottomPanelHeight: 0 };
  @Local battleActive: boolean = false;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.battleActive = isInBattle() || hasBattleResult();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'battle' || changeType === 'all') {
        this.battleActive = isInBattle() || hasBattleResult();
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  build() {
    Column() {
      if (this.battleActive) {
        BattlePreviewPanel()
      } else if (this.config.mode === PanelMode.BottomPanel) {
        BottomPanel({ panelHeight: this.config.bottomPanelHeight })
      } else if (this.config.mode === PanelMode.FloatOverlay) {
        FloatOverlayPanel()
      }
    }
    .width('100%')
    .height('100%')
  }
}
