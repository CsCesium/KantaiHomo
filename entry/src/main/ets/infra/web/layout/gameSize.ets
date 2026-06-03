import { GAME_ASPECT_RATIO } from './responsive';

export const GAME_SIZE_DEFAULT_PERCENT: number = 100;
export const GAME_SIZE_MIN_PERCENT: number = 60;
export const GAME_SIZE_MAX_PERCENT: number = 100;
export const GAME_SIZE_STEP_PERCENT: number = 5;

export interface GameViewportBox {
  widthVp: number;
  heightVp: number;
  leftMarginVp: number;
}

export function normalizeGameSizePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return GAME_SIZE_DEFAULT_PERCENT;
  }
  const stepped: number = Math.round(value / GAME_SIZE_STEP_PERCENT) * GAME_SIZE_STEP_PERCENT;
  return Math.min(GAME_SIZE_MAX_PERCENT, Math.max(GAME_SIZE_MIN_PERCENT, stepped));
}

export function resolveGameViewportBox(maxWidthVp: number, maxHeightVp: number, percent: number): GameViewportBox {
  if (maxWidthVp <= 0 || maxHeightVp <= 0) {
    return { widthVp: 0, heightVp: 0, leftMarginVp: 0 };
  }

  const safePercent: number = normalizeGameSizePercent(percent);
  const baseWidthVp: number = Math.floor(Math.min(maxWidthVp, maxHeightVp * GAME_ASPECT_RATIO));
  const baseHeightVp: number = Math.floor(baseWidthVp / GAME_ASPECT_RATIO);
  const widthVp: number = Math.max(1, Math.floor(baseWidthVp * safePercent / 100));
  const heightVp: number = Math.max(1, Math.floor(widthVp / GAME_ASPECT_RATIO));
  const leftMarginVp: number = Math.max(0, Math.floor((maxWidthVp - widthVp) / 2));

  return { widthVp, heightVp, leftMarginVp };
}
