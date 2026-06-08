export enum HostMode { COMPACT = 0, EXPANDED = 1 }
export type FitPolicy = 'height' | 'width' | 'auto';

export enum WindowScene {
  FULLSCREEN = 'fullscreen',
  SPLIT = 'split',
  FLOATING = 'floating'
}

export interface LayoutInput {
  widthVp: number;
  heightVp: number;
  scene: WindowScene;
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
  /** Whether user-configured game size scaling should be applied after this decision. */
  useCustomGameSize?: boolean;
}

const NARROW_SHORT_SIDE_VP = 420;
const WIDE_SCREEN_MIN_WIDTH_VP = 700;
const MIN_BOTTOM_PANEL_VP = 96;
const GAME_HEIGHT_WIDTH_RATIO = 720 / 1200;
/** 游戏画面宽高比（宽/高） */
export const GAME_ASPECT_RATIO = 1200 / 720;
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

  // Portrait-like split: scale game to full width and dock panel below when
  // width-fit leaves enough vertical room.
  if (scene === WindowScene.SPLIT) {
    if (!portrait) {
      const wideLandscapeSplit: boolean = widthVp >= WIDE_SCREEN_MIN_WIDTH_VP;
      return {
        mode: HostMode.COMPACT,
        policy: 'height',
        lockFit: true,
        showSideButtons: wideLandscapeSplit,
        showBottomTools: false,
        gameWidthVp: widthVp,
        gameHeightVp: heightVp,
        gameLeftMarginVp: 0,
        sidebarWidthVp: wideLandscapeSplit ? calcSidebarWidth(widthVp, heightVp) : 0,
        useCustomGameSize: wideLandscapeSplit,
      };
    }

    const contentH: number = Math.min(heightVp, widthVp * GAME_HEIGHT_WIDTH_RATIO);
    const bottomPanelH: number = heightVp - contentH;
    const portraitSplitWithPanel: boolean = portrait;
    const canShowSplitBottomPanel: boolean = bottomPanelH >= MIN_BOTTOM_PANEL_VP &&
      portraitSplitWithPanel;
    if (canShowSplitBottomPanel) {
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
    // Very wide landscape split or narrow split: maximize game canvas, no panel.
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

  // Portrait tool surfaces use a bottom row + panel whenever width-fit leaves
  // enough room below the game canvas.
  if (portrait) {
    const contentH: number = Math.min(heightVp, widthVp * GAME_HEIGHT_WIDTH_RATIO);
    const bottomPanelH: number = heightVp - contentH;
    if (bottomPanelH >= MIN_BOTTOM_PANEL_VP) {
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
  }

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
      useCustomGameSize: portrait,
    };
  }

  if (widthVp >= WIDE_SCREEN_MIN_WIDTH_VP) {
    const contentH: number = Math.min(heightVp, widthVp * GAME_HEIGHT_WIDTH_RATIO);
    const bottomPanelH: number = heightVp - contentH;
    if (bottomPanelH >= MIN_BOTTOM_PANEL_VP) {
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
