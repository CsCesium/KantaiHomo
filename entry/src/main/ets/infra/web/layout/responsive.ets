export enum HostMode { COMPACT = 0, EXPANDED = 1 }

export enum LayoutMode {
  NARROW_SPLIT = 'NARROW_SPLIT',
  WIDE_SPLIT_TOP_BOTTOM = 'WIDE_SPLIT_TOP_BOTTOM',
  WIDE_SPLIT_LEFT_RIGHT_PORTRAIT_FIT = 'WIDE_SPLIT_LEFT_RIGHT_PORTRAIT_FIT',
  WIDE_SPLIT_LEFT_RIGHT_DASHBOARD = 'WIDE_SPLIT_LEFT_RIGHT_DASHBOARD',
  FLOATING = 'FLOATING'
}

export enum ViewportFitStrategy {
  FILL_HORIZONTAL = 'FILL_HORIZONTAL',
  FILL_VERTICAL = 'FILL_VERTICAL'
}

export type FitPolicy = 'height' | 'width'|'auto';

export interface LayoutInput {
  widthVp: number;
  heightVp: number;
  isLandscape: boolean;
  windowStatus: number;
  isFullscreen: boolean;
}

export interface LayoutDecision {
  mode: HostMode;
  layout: LayoutMode;
  policy: FitPolicy;
  showFixedButtons: boolean;
  showDashboard: boolean;
  viewportFit: ViewportFitStrategy;
}

function isFloatingWindow(isFullscreen: boolean): boolean {
  return !isFullscreen;
}

export function decideLayout(input: LayoutInput): LayoutDecision {
  const { widthVp, heightVp, isLandscape, windowStatus, isFullscreen } = input;
  const shortSide = Math.min(widthVp, heightVp);
  const isUnknownStatus = windowStatus < 0;
  const floating = isFloatingWindow(isFullscreen);

  if (floating || isUnknownStatus) {
    return {
      mode: HostMode.COMPACT,
      layout: LayoutMode.FLOATING,
      policy: 'height',
      showFixedButtons: true,
      showDashboard: false,
      viewportFit: ViewportFitStrategy.FILL_VERTICAL
    };
  }

  if (shortSide <= 420) {
    return {
      mode: HostMode.COMPACT,
      layout: LayoutMode.NARROW_SPLIT,
      policy: 'height',
      showFixedButtons: true,
      showDashboard: false,
      viewportFit: ViewportFitStrategy.FILL_VERTICAL
    };
  }

  if (widthVp >= 980 && isLandscape) {
    return {
      mode: HostMode.EXPANDED,
      layout: LayoutMode.WIDE_SPLIT_LEFT_RIGHT_DASHBOARD,
      policy: 'width',
      showFixedButtons: false,
      showDashboard: true,
      viewportFit: ViewportFitStrategy.FILL_HORIZONTAL
    };
  }

  if (widthVp >= 700) {
    return {
      mode: HostMode.EXPANDED,
      layout: isLandscape
        ? LayoutMode.WIDE_SPLIT_LEFT_RIGHT_PORTRAIT_FIT
        : LayoutMode.WIDE_SPLIT_TOP_BOTTOM,
      policy: 'width',
      showFixedButtons: false,
      showDashboard: false,
      viewportFit: isLandscape
        ? ViewportFitStrategy.FILL_HORIZONTAL
        : ViewportFitStrategy.FILL_VERTICAL
    };
  }

  return {
    mode: isLandscape ? HostMode.COMPACT : HostMode.EXPANDED,
    layout: LayoutMode.WIDE_SPLIT_TOP_BOTTOM,
    policy: isLandscape ? 'height' : 'width',
    showFixedButtons: isLandscape,
    showDashboard: false,
    viewportFit: isLandscape
      ? ViewportFitStrategy.FILL_VERTICAL
      : ViewportFitStrategy.FILL_HORIZONTAL
  };
}
