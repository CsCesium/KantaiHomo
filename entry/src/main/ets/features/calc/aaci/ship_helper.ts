/**
 * AACI Ship Classification Helpers
 */

import { AaciShipRestriction } from './aaci_types';

// ==================== 艦娘 Master ID ====================

/** 秋月型 */
export const AKIZUKI_CLASS_IDS: Set<number> = new Set([
  421,  // 秋月
  330,  // 秋月改
  422,  // 照月
  346,  // 照月改
  423,  // 初月
  423,  // 初月改 (same?)
  532,  // 涼月
  537,  // 涼月改
  699,  // 冬月
  700,  // 冬月改
  // 以下は改造後のID
]);

/** 摩耶改二 */
export const MAYA_K2_IDS: Set<number> = new Set([
  428,  // 摩耶改二
]);

/** 鳥海改二 */
export const CHOUKAI_K2_IDS: Set<number> = new Set([
  427,  // 鳥海改二
]);

/** 伊勢型改二 */
export const ISE_CLASS_K2_IDS: Set<number> = new Set([
  553,  // 伊勢改二
  554,  // 日向改二
]);

/** 武蔵改二 */
export const MUSASHI_K2_IDS: Set<number> = new Set([
  546,  // 武蔵改二
]);

/** 大和型改二 (大和改二/改二重) */
export const YAMATO_K2_IDS: Set<number> = new Set([
  911,  // 大和改二
  916,  // 大和改二重
  546,  // 武蔵改二
]);

/** 皐月改二 */
export const SATSUKI_K2_IDS: Set<number> = new Set([
  418,  // 皐月改二
]);

/** 文月改二 */
export const FUMIZUKI_K2_IDS: Set<number> = new Set([
  548,  // 文月改二
]);

/** 鬼怒改二 */
export const KINU_K2_IDS: Set<number> = new Set([
  487,  // 鬼怒改二
]);

/** UIT-25/伊504 */
export const UIT_I504_IDS: Set<number> = new Set([
  539,  // UIT-25
  530,  // 伊504
]);

/** 天龍改二 */
export const TENRYU_K2_IDS: Set<number> = new Set([
  477,  // 天龍改二
]);

/** 龍田改二 */
export const TATSUTA_K2_IDS: Set<number> = new Set([
  478,  // 龍田改二
]);

/** 五十鈴改二 */
export const ISUZU_K2_IDS: Set<number> = new Set([
  141,  // 五十鈴改二
]);

/** 霞改二乙 */
export const KASUMI_K2B_IDS: Set<number> = new Set([
  470,  // 霞改二乙
]);

/** 由良改二 */
export const YURA_K2_IDS: Set<number> = new Set([
  488,  // 由良改二
]);

/** 磯風乙改 */
export const ISOKAZE_B_IDS: Set<number> = new Set([
  557,  // 磯風乙改
]);

/** 浜風乙改 */
export const HAMAKAZE_B_IDS: Set<number> = new Set([
  558,  // 浜風乙改
]);

/** Fletcher級 */
export const FLETCHER_CLASS_IDS: Set<number> = new Set([
  562,  // Fletcher
  563,  // Fletcher改
  596,  // Johnston
  597,  // Johnston改
  628,  // Heywood L.E.
  629,  // Heywood L.E.改
]);

/** Atlanta */
export const ATLANTA_IDS: Set<number> = new Set([
  597,  // Atlanta (これは間違い?)
  621,  // Atlanta
  622,  // Atlanta改
]);

/** 榛名改二乙 */
export const HARUNA_K2B_IDS: Set<number> = new Set([
  593,  // 榛名改二乙
]);

/** Gotland改/andra */
export const GOTLAND_K_IDS: Set<number> = new Set([
  579,  // Gotland改
  630,  // Gotland andra
]);

// ==================== 艦種 ID 定義 ====================

/** 戦艦 (航空戦艦含む) */
export const BATTLESHIP_STYPE: Set<number> = new Set([
  8,   // 巡洋戦艦 (金剛型など)
  9,   // 戦艦
  10,  // 航空戦艦
]);

/** 潜水艦 */
export const SUBMARINE_STYPE: Set<number> = new Set([
  13,  // 潜水艦
  14,  // 潜水空母
]);

/** イギリス艦の国籍 ctype */
export const BRITISH_CTYPES: Set<number> = new Set([
  67,  // Nelson級
  78,  // Queen Elizabeth級
  88,  // Ark Royal級
  93,  // Jervis級
  108, // Sheffield級
]);

// ==================== 判定関数 ====================

/**
 * 秋月型かどうか
 */
export function isAkizukiClass(shipMasterId: number): boolean {
  return AKIZUKI_CLASS_IDS.has(shipMasterId);
}

/**
 * 摩耶改二かどうか
 */
export function isMayaK2(shipMasterId: number): boolean {
  return MAYA_K2_IDS.has(shipMasterId);
}

/**
 * 鳥海改二かどうか
 */
export function isChoukaiK2(shipMasterId: number): boolean {
  return CHOUKAI_K2_IDS.has(shipMasterId);
}

/**
 * 鳥海改二/摩耶改二かどうか
 */
export function isChoukaiOrMayaK2(shipMasterId: number): boolean {
  return isChoukaiK2(shipMasterId) || isMayaK2(shipMasterId);
}

/**
 * 伊勢型改二かどうか
 */
export function isIseClassK2(shipMasterId: number): boolean {
  return ISE_CLASS_K2_IDS.has(shipMasterId);
}

/**
 * 武蔵改二かどうか
 */
export function isMusashiK2(shipMasterId: number): boolean {
  return MUSASHI_K2_IDS.has(shipMasterId);
}

/**
 * 大和型改二かどうか
 */
export function isYamatoK2(shipMasterId: number): boolean {
  return YAMATO_K2_IDS.has(shipMasterId);
}

/**
 * 皐月改二/文月改二かどうか
 */
export function isSatsukiOrFumizukiK2(shipMasterId: number): boolean {
  return SATSUKI_K2_IDS.has(shipMasterId) || FUMIZUKI_K2_IDS.has(shipMasterId);
}

/**
 * 鬼怒改二かどうか
 */
export function isKinuK2(shipMasterId: number): boolean {
  return KINU_K2_IDS.has(shipMasterId);
}

/**
 * UIT-25/伊504かどうか
 */
export function isUitOrI504(shipMasterId: number): boolean {
  return UIT_I504_IDS.has(shipMasterId);
}

/**
 * 天龍改二かどうか
 */
export function isTenryuK2(shipMasterId: number): boolean {
  return TENRYU_K2_IDS.has(shipMasterId);
}

/**
 * 龍田改二かどうか
 */
export function isTatsutaK2(shipMasterId: number): boolean {
  return TATSUTA_K2_IDS.has(shipMasterId);
}

/**
 * 五十鈴改二かどうか
 */
export function isIsuzuK2(shipMasterId: number): boolean {
  return ISUZU_K2_IDS.has(shipMasterId);
}

/**
 * 霞改二乙かどうか
 */
export function isKasumiK2B(shipMasterId: number): boolean {
  return KASUMI_K2B_IDS.has(shipMasterId);
}

/**
 * 由良改二かどうか
 */
export function isYuraK2(shipMasterId: number): boolean {
  return YURA_K2_IDS.has(shipMasterId);
}

/**
 * 磯風乙改/浜風乙改かどうか
 */
export function isIsokazeOrHamakazeB(shipMasterId: number): boolean {
  return ISOKAZE_B_IDS.has(shipMasterId) || HAMAKAZE_B_IDS.has(shipMasterId);
}

/**
 * Fletcher級かどうか
 */
export function isFletcherClass(shipMasterId: number): boolean {
  return FLETCHER_CLASS_IDS.has(shipMasterId);
}

/**
 * Atlantaかどうか
 */
export function isAtlanta(shipMasterId: number): boolean {
  return ATLANTA_IDS.has(shipMasterId);
}

/**
 * 榛名改二乙かどうか
 */
export function isHarunaK2B(shipMasterId: number): boolean {
  return HARUNA_K2B_IDS.has(shipMasterId);
}

/**
 * Gotland改/andraかどうか
 */
export function isGotlandK(shipMasterId: number): boolean {
  return GOTLAND_K_IDS.has(shipMasterId);
}

/**
 * 戦艦かどうか (艦種で判定)
 */
export function isBattleship(stype: number): boolean {
  return BATTLESHIP_STYPE.has(stype);
}

/**
 * 潜水艦かどうか (艦種で判定)
 */
export function isSubmarine(stype: number): boolean {
  return SUBMARINE_STYPE.has(stype);
}

/**
 * イギリス艦かどうか (ctypeで判定)
 */
export function isBritish(ctype: number): boolean {
  return BRITISH_CTYPES.has(ctype);
}

// ==================== 制限チェック ====================

/**
 * 艦娘が指定された AACI 制限を満たすかどうか
 */
export function matchesShipRestriction(
  restriction: AaciShipRestriction,
  shipMasterId: number,
  stype: number,
  ctype: number,
): boolean {
  switch (restriction) {
    case AaciShipRestriction.GENERIC:
      return !isSubmarine(stype);
    case AaciShipRestriction.AKIZUKI_CLASS:
      return isAkizukiClass(shipMasterId);
    case AaciShipRestriction.MAYA_K2:
      return isMayaK2(shipMasterId);
    case AaciShipRestriction.ISE_CLASS_K2:
      return isIseClassK2(shipMasterId);
    case AaciShipRestriction.MUSASHI_K2:
      return isMusashiK2(shipMasterId);
    case AaciShipRestriction.SATSUKI_FUMIZUKI_K2:
      return isSatsukiOrFumizukiK2(shipMasterId);
    case AaciShipRestriction.KINU_K2:
      return isKinuK2(shipMasterId);
    case AaciShipRestriction.UIT_I504:
      return isUitOrI504(shipMasterId);
    case AaciShipRestriction.TENRYU_K2:
      return isTenryuK2(shipMasterId);
    case AaciShipRestriction.ISUZU_K2:
      return isIsuzuK2(shipMasterId);
    case AaciShipRestriction.KASUMI_K2B:
      return isKasumiK2B(shipMasterId);
    case AaciShipRestriction.YURA_K2:
      return isYuraK2(shipMasterId);
    case AaciShipRestriction.CHOUKAI_MAYA_K2:
      return isChoukaiOrMayaK2(shipMasterId);
    case AaciShipRestriction.ISOKAZE_HAMAKAZE_B:
      return isIsokazeOrHamakazeB(shipMasterId);
    case AaciShipRestriction.FLETCHER_CLASS:
      return isFletcherClass(shipMasterId);
    case AaciShipRestriction.ATLANTA:
      return isAtlanta(shipMasterId);
    case AaciShipRestriction.YAMATO_K2:
      return isYamatoK2(shipMasterId);
    case AaciShipRestriction.HARUNA_K2B:
      return isHarunaK2B(shipMasterId);
    case AaciShipRestriction.BATTLESHIP:
      return isBattleship(stype);
    case AaciShipRestriction.BRITISH:
      return isBritish(ctype);
    case AaciShipRestriction.TATSUTA_K2:
      return isTatsutaK2(shipMasterId);
    case AaciShipRestriction.GOTLAND_K:
      return isGotlandK(shipMasterId);
    default:
      return false;
  }
}
