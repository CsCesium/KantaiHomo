export type HostMode = 'SMALL' | 'EXPANDED';
export type FitPolicy = 'height' | 'width';

export interface LayoutDecision { mode: HostMode; policy: FitPolicy; }

export function decideLayout(widthVp: number, heightVp: number): LayoutDecision {
  const shortSide = Math.min(widthVp, heightVp);

  if (shortSide <= 420) return { mode: 'SMALL', policy: 'height' };
  if (widthVp >= 700)   return { mode: 'EXPANDED', policy: 'width' };

  return (widthVp >= heightVp)
    ? { mode: 'SMALL', policy: 'height' }
    : { mode: 'EXPANDED', policy: 'width' };
}