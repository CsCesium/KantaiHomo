export const enum PanelMode {
  Hidden       = 'HIDDEN',
  FloatOverlay = 'FLOAT_OVERLAY',
  BottomPanel  = 'BOTTOM_PANEL',
}

export interface PanelLayoutConfig {
  mode: PanelMode;
  // BottomPanel 模式下（vp），FloatOverlay 可忽略
  bottomPanelHeight: number;
}
