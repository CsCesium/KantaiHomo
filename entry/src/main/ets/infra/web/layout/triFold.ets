import display from '@ohos.display';
import { WindowScene } from './responsive';

export interface TriFoldLayout {
  active: boolean;
  mainWidthVp: number;
  infoWidthVp: number;
}

/** Reserve one of three faces only when the whole unfolded screen is available. */
export function resolveTriFoldLayout(
  widthVp: number,
  heightVp: number,
  scene: WindowScene,
  foldStatus: display.FoldStatus,
): TriFoldLayout {
  const active: boolean = scene === WindowScene.FULLSCREEN &&
    foldStatus === display.FoldStatus.FOLD_STATUS_EXPANDED_WITH_SECOND_EXPANDED &&
    heightVp > 0 && widthVp > heightVp;
  const infoWidthVp: number = active ? Math.floor(widthVp / 3) : 0;
  const mainWidthVp: number = widthVp - infoWidthVp;
  return {
    active,
    mainWidthVp,
    infoWidthVp,
  };
}
