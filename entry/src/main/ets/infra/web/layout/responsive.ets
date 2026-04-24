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
  /** Compact 模式下右侧可用于侧边栏的宽度（vp），0 表示不显示侧边栏 */
  sidebarWidthVp: number;
}

const NARROW_SHORT_SIDE_VP = 420;
const GAME_HEIGHT_WIDTH_RATIO = 720 / 1200;
/** 游戏画面宽高比（宽/高） */
const GAME_ASPECT_RATIO = 1200 / 720;
/** 侧边栏最小宽度（vp），低于此值不显示侧边栏 */
const MIN_SIDEBAR_VP = 44;
/** 侧边栏最大宽度（vp） */
const MAX_SIDEBAR_VP = 80;

function isNarrowScreen(widthVp: number, heightVp: number): boolean {
  return Math.min(widthVp, heightVp) <= NARROW_SHORT_SIDE_VP;
}

function isPortraitViewport(widthVp: number, heightVp: number): boolean {
  return heightVp >= widthVp;
}

/**
 * 计算 compact height-fit 模式下右侧可用侧边栏宽度。
 * 游戏画面以 height 为准缩放，实际画面宽 = heightVp × ASPECT_RATIO。
 * 右侧剩余 = viewportWidth - 游戏画面宽。
 * 仅横屏且剩余 >= MIN_SIDEBAR_VP 时才分配侧边栏。
 */
function calcSidebarWidth(widthVp: number, heightVp: number): number {
  if (heightVp >= widthVp) return 0;   // 竖屏不显示侧边栏
  const gameContentW = heightVp * GAME_ASPECT_RATIO;
  const totalSpace = widthVp - gameContentW;
  const rightSpace = Math.floor(totalSpace / 2);
  if (rightSpace < MIN_SIDEBAR_VP) return 0;
  return Math.min(MAX_SIDEBAR_VP, Math.floor(rightSpace));
}

export function decideLayout(input: LayoutInput): LayoutDecision {
  const widthVp: number = input.widthVp;
  const heightVp: number = input.heightVp;
  const scene: WindowScene = input.scene;
  const wideSplitMode: WideSplitMode = input.wideSplitMode;
  const narrow: boolean = isNarrowScreen(widthVp, heightVp);
  const portrait: boolean = isPortraitViewport(widthVp, heightVp);

  // Floating window should always be pure game content without fixed buttons.
  if (scene === WindowScene.FLOATING) {
    return {
      mode: HostMode.COMPACT,
      policy: 'width',
      lockFit: true,
      showSideButtons: false,
      showBottomTools: false,
      gameWidthVp: widthVp,
      gameHeightVp: heightVp,
      gameLeftMarginVp: 0,
      sidebarWidthVp: 0,
    };
  }

  // Portrait split: covers both top/bottom split on phones and left/right split on unfolded
  // foldable devices (the latter produces a wide-but-tall portrait window).
  if (scene === WindowScene.SPLIT && portrait) {
    // Wide portrait window (left/right split on unfolded foldable): treat like tablet portrait —
    // fill width with the game, put the panel below.
    if (!narrow) {
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
        sidebarWidthVp: 0,
      };
    }
    // Narrow portrait window (top/bottom split on a phone): maximize game canvas.
    return {
      mode: HostMode.COMPACT,
      policy: 'height',
      lockFit: true,
      showSideButtons: false,
      showBottomTools: false,
      gameWidthVp: widthVp,
      gameHeightVp: heightVp,
      gameLeftMarginVp: 0,
      sidebarWidthVp: 0,
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
        sidebarWidthVp: calcSidebarWidth(widthVp, heightVp),
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
      sidebarWidthVp: 0,
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
      gameLeftMarginVp: 0,
      sidebarWidthVp: calcSidebarWidth(widthVp, heightVp),
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
      sidebarWidthVp: 0,
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
      gameLeftMarginVp: 0,
      sidebarWidthVp: calcSidebarWidth(widthVp, heightVp),
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
    sidebarWidthVp: 0,
  };
}
