import { HostMode, LayoutDecision } from '../../infra/web/layout/responsive';
import { PanelLayoutConfig, PanelMode } from './type';

/**
 * Maps the current layout decision to the appropriate panel config.
 *
 * COMPACT  → FloatOverlay: semi-transparent panel floating over the game
 * EXPANDED → BottomPanel:  opaque panel docked below the game viewport,
 *                          height = remaining space after gameHeightVp
 */
export function decidePanelLayout(
  decision: LayoutDecision,
  viewportHeightVp: number,
): PanelLayoutConfig {
  if (decision.mode === HostMode.COMPACT) {
    return { mode: PanelMode.FloatOverlay, bottomPanelHeight: 0 };
  }
  const panelH = Math.max(viewportHeightVp - decision.gameHeightVp, 0);
  return { mode: PanelMode.BottomPanel, bottomPanelHeight: panelH };
}
