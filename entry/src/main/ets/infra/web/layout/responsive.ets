export enum HostMode { COMPACT = 0, EXPANDED = 1 }
export type FitPolicy = 'height' | 'width' | 'auto';

export enum WindowScene {
  FULLSCREEN = 'fullscreen',
  SPLIT = 'split',
  FLOATING = 'floating'
}

export enum WideSplitMode {
  // Keep the game viewport vertically filled like compact mode.
  PORTRAIT_FILL = 'portrait_fill',
  // Fill width and reserve bottom dashboard area in wide split mode.
  LANDSCAPE_WITH_DASHBOARD = 'landscape_with_dashboard'
}

export interface LayoutInput {
  widthVp: number;
  heightVp: number;
  scene: WindowScene;
  wideSplitMode: WideSplitMode;
}

export interface LayoutDecision {
  mode: HostMode;
  policy: FitPolicy;
  lockFit: boolean;
  showSideButtons: boolean;
  showBottomTools: boolean;
  gameWidthVp: number;
  gameHeightVp: number;
  gameLeftMarginVp: number;
}

const NARROW_SHORT_SIDE_VP = 420;
const COMPACT_GUTTER_VP = 30;
const GAME_HEIGHT_WIDTH_RATIO = 720 / 1200;

function isNarrowScreen(widthVp: number, heightVp: number): boolean {
  return Math.min(widthVp, heightVp) <= NARROW_SHORT_SIDE_VP;
}

function isPortraitViewport(widthVp: number, heightVp: number): boolean {
  return heightVp >= widthVp;
}

export function decideLayout(input: LayoutInput): LayoutDecision {
  const { widthVp, heightVp, scene, wideSplitMode } = input;
  const narrow: boolean = isNarrowScreen(widthVp, heightVp);
  const portrait: boolean = isPortraitViewport(widthVp, heightVp);

  // Floating window should always be pure game content without fixed buttons.
  if (scene === WindowScene.FLOATING) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      lockFit: true,
      showSideButtons: false,
      showBottomTools: false,
      gameWidthVp: widthVp,
      gameHeightVp: heightVp,
      gameLeftMarginVp: 0,
    };
  }

  // In split mode, stacked windows (top/bottom split) should maximize game area.
  if (scene === WindowScene.SPLIT && portrait) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      lockFit: true,
      showSideButtons: false,
      showBottomTools: false,
      gameWidthVp: widthVp,
      gameHeightVp: heightVp,
      gameLeftMarginVp: 0,
    };
  }

  // Wide split + left/right split mode supports two user-selectable behaviors.
  if (scene === WindowScene.SPLIT && !portrait && !narrow) {
    if (wideSplitMode === WideSplitMode.PORTRAIT_FILL) {
      return {
        mode: HostMode.COMPACT,
        policy: 'height',
        lockFit: true,
        showSideButtons: false,
        showBottomTools: false,
        gameWidthVp: widthVp,
        gameHeightVp: heightVp,
        gameLeftMarginVp: 0,
      };
    }

    const contentH: number = Math.min(heightVp, widthVp * GAME_HEIGHT_WIDTH_RATIO);
    return {
      mode: HostMode.EXPANDED,
      policy: 'width',
      lockFit: false,
      showSideButtons: false,
      showBottomTools: true,
      gameWidthVp: widthVp,
      gameHeightVp: Math.floor(contentH),
      gameLeftMarginVp: 0,
    };
  }

  // Keep current fullscreen behavior for normal usage while centralizing all layout outputs.
  if (narrow) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      lockFit: true,
      showSideButtons: true,
      showBottomTools: false,
      gameWidthVp: widthVp,
      gameHeightVp: heightVp,
      gameLeftMarginVp: COMPACT_GUTTER_VP,
    };
  }

  if (widthVp >= 700) {
    const contentH: number = Math.min(heightVp, widthVp * GAME_HEIGHT_WIDTH_RATIO);
    return {
      mode: HostMode.EXPANDED,
      policy: 'width',
      lockFit: false,
      showSideButtons: false,
      showBottomTools: true,
      gameWidthVp: widthVp,
      gameHeightVp: Math.floor(contentH),
      gameLeftMarginVp: 0,
    };
  }

  if (!portrait) {
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      lockFit: true,
      showSideButtons: true,
      showBottomTools: false,
      gameWidthVp: widthVp,
      gameHeightVp: heightVp,
      gameLeftMarginVp: COMPACT_GUTTER_VP,
    };
  }

  const contentH: number = Math.min(heightVp, widthVp * GAME_HEIGHT_WIDTH_RATIO);
  return {
    mode: HostMode.EXPANDED,
    policy: 'width',
    lockFit: false,
    showSideButtons: false,
    showBottomTools: true,
    gameWidthVp: widthVp,
    gameHeightVp: Math.floor(contentH),
    gameLeftMarginVp: 0,
  };
}
