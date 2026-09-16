import display from '@ohos.display';
import { WindowScene } from './responsive';

// Leave at least 280 vp for the information pane and keep compact windows unchanged.
const TABLET_INFO_MIN_WIDTH_VP: number = 280;
const TABLET_MIN_HEIGHT_VP: number = 420;

export interface TriFoldLayout {
  active: boolean;
  mainWidthVp: number;
  infoWidthVp: number;
}

export function isTriFoldPortrait(
  widthVp: number,
  heightVp: number,
  scene: WindowScene,
  foldStatus: display.FoldStatus,
): boolean {
  return scene === WindowScene.FULLSCREEN &&
    foldStatus === display.FoldStatus.FOLD_STATUS_EXPANDED_WITH_SECOND_EXPANDED &&
    widthVp > 0 && heightVp > widthVp;
}

/** Share the 2:1 layout with sufficiently large fullscreen landscape tablet windows. */
export function resolveTriFoldLayout(
  widthVp: number,
  heightVp: number,
  scene: WindowScene,
  foldStatus: display.FoldStatus,
  deviceType: string = '',
): TriFoldLayout {
  const fullyUnfolded: boolean =
    foldStatus === display.FoldStatus.FOLD_STATUS_EXPANDED_WITH_SECOND_EXPANDED;
  const largeTablet: boolean = deviceType === 'tablet' &&
    widthVp >= TABLET_INFO_MIN_WIDTH_VP * 3 && heightVp > TABLET_MIN_HEIGHT_VP;
  const active: boolean = scene === WindowScene.FULLSCREEN &&
    (fullyUnfolded || largeTablet) &&
    heightVp > 0 && widthVp > heightVp;
  const infoWidthVp: number = active ? Math.floor(widthVp / 3) : 0;
  const mainWidthVp: number = widthVp - infoWidthVp;
  return {
    active,
    mainWidthVp,
    infoWidthVp,
  };
}
