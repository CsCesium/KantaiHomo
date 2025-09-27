export enum HostMode { COMPACT = 0, EXPANDED = 1 }
export type FitPolicy = 'height' | 'width'|'auto';

export interface LayoutDecision { mode: HostMode; policy: FitPolicy; }

export function decideLayout(widthVp: number, heightVp: number): LayoutDecision {
  const shortSide = Math.min(widthVp, heightVp);

  if (shortSide <= 420) return { mode: HostMode.COMPACT, policy: 'height' };
  if (widthVp >= 700)   return { mode: HostMode.EXPANDED, policy: 'width' };

  return (widthVp >= heightVp)
    ? { mode: HostMode.COMPACT, policy: 'height' }
    : { mode: HostMode.EXPANDED, policy: 'width' };
}