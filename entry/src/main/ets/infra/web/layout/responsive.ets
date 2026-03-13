export enum HostMode { COMPACT = 0, EXPANDED = 1 }
export type LrMode = 'portraitFit' | 'landscapeWithDashboard';
export type FitPolicy = 'height' | 'width'|'auto';

export interface LayoutDecision {
  mode: HostMode;
  lrMode: LrMode;
  policy: FitPolicy;
  showBottomTools: boolean;
}

export function decideLayout(widthVp: number, heightVp: number, lrMode: LrMode): LayoutDecision {
  const shortSide = Math.min(widthVp, heightVp);

  if (shortSide <= 420) {
    return {
      mode: HostMode.COMPACT,
      lrMode,
      policy: 'height',
      showBottomTools: false
    };
  }
  if (widthVp >= 700) {
    return {
      mode: HostMode.EXPANDED,
      lrMode,
      policy: lrMode === 'portraitFit' ? 'height' : 'width',
      showBottomTools: lrMode === 'landscapeWithDashboard'
    };
  }

  return (widthVp >= heightVp)
    ? {
      mode: HostMode.COMPACT,
      lrMode,
      policy: 'height',
      showBottomTools: false
    }
    : {
      mode: HostMode.EXPANDED,
      lrMode,
      policy: lrMode === 'portraitFit' ? 'height' : 'width',
      showBottomTools: lrMode === 'landscapeWithDashboard'
    };
}
