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

/** Single ship display state for panel rendering. */
export interface ShipItem {
  id: number;
  name: string;
  shipType: string; // short type label, e.g. '駆', '戦', '空'
  level: number;
  hp: number;
  hpMax: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
}
