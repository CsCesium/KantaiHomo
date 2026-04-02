export enum HostMode { COMPACT = 0, EXPANDED = 1 }
export type FitPolicy = 'height' | 'width'|'auto';

export enum ViewScene {
  NARROW = 'narrow',
  WIDE_TOP_BOTTOM = 'wide_top_bottom',
  WIDE_LEFT_RIGHT = 'wide_left_right',
  FLOATING = 'floating'
}

export interface LayoutDecision {
  mode: HostMode;
  policy: FitPolicy;
  scene: ViewScene;
  showFixedButtons: boolean;
  showBottomTools: boolean;
  allowWideSplitModeSwitch: boolean;
}

export interface LayoutInput {
  widthVp: number;
  heightVp: number;
  isFloating: boolean;
  preferWideLrDashboard: boolean;
}

export function decideLayout(input: LayoutInput): LayoutDecision {
  const { widthVp, heightVp, isFloating, preferWideLrDashboard } = input;
  const shortSide = Math.min(widthVp, heightVp);
  const isWidePane = widthVp >= heightVp;

  if (isFloating) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      scene: ViewScene.FLOATING,
      showFixedButtons: false,
      showBottomTools: false,
      allowWideSplitModeSwitch: false
    };
  }

  if (shortSide <= 500) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      scene: ViewScene.NARROW,
      showFixedButtons: false,
      showBottomTools: false,
      allowWideSplitModeSwitch: false
    };
  }

  if (isWidePane) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      scene: ViewScene.WIDE_TOP_BOTTOM,
      showFixedButtons: false,
      showBottomTools: false,
      allowWideSplitModeSwitch: false
    };
  }

  return {
    mode: preferWideLrDashboard ? HostMode.EXPANDED : HostMode.COMPACT,
    policy: preferWideLrDashboard ? 'width' : 'height',
    scene: ViewScene.WIDE_LEFT_RIGHT,
    showFixedButtons: false,
    showBottomTools: preferWideLrDashboard,
    allowWideSplitModeSwitch: true
  };
}
