/**
 * Anti-Air Cut-In (AACI) Type Definitions
 * 対空カットイン種別定義
 *
 * 参考: https://wikiwiki.jp/kancolle/対空砲火
 */

// ==================== AACI 種別値 ====================

/**
 * AACI 種別値
 */
export enum AaciTypeId {
  // 秋月型専用
  AKIZUKI_1 = 1,   // 高角砲×2 + 対空電探
  AKIZUKI_2 = 2,   // 高角砲 + 対空電探
  AKIZUKI_3 = 3,   // 高角砲×2

  // 戦艦三式弾
  BB_SANSHIKI_4 = 4,  // 大口径主砲 + 三式弾 + 高射装置 + 対空電探
  BB_SANSHIKI_6 = 6,  // 大口径主砲 + 三式弾 + 高射装置

  // 汎用
  GENERIC_5 = 5,   // 特殊高角砲×2 + 対空電探
  GENERIC_7 = 7,   // 高角砲 + 高射装置 + 対空電探
  GENERIC_8 = 8,   // 高射装置 + 対空電探
  GENERIC_9 = 9,   // 高角砲 + 高射装置

  // 摩耶改二専用
  MAYA_10 = 10,    // 高角砲 + 特殊機銃 + 対空電探
  MAYA_11 = 11,    // 高角砲 + 特殊機銃

  // 汎用機銃
  GENERIC_12 = 12, // 特殊機銃 + 機銃 + 対空電探

  // 伊勢型改二/日向改二専用
  ISE_25 = 25,     // 噴進砲改二 + 対空電探 + 三式弾
  ISE_28 = 28,     // 噴進砲改二 + 対空電探

  // 武蔵改二専用
  MUSASHI_26 = 26, // 10cm連装高角砲改+増設機銃 + 対空電探

  // 皐月改二/文月改二専用
  SATSUKI_22 = 22, // 特殊機銃

  // 鬼怒改二専用
  KINU_19 = 19,    // 高角砲(非高射装置) + 特殊機銃

  // UIT-25/伊504専用
  UIT_23 = 23,     // 通常機銃

  // 天龍改二専用
  TENRYU_24 = 24,  // 高角砲 + 高角砲 + 高角砲 (3本)

  // 五十鈴改二専用
  ISUZU_14 = 14,   // 高角砲 + 対空機銃 + 対空電探

  // 霞改二乙専用
  KASUMI_16 = 16,  // 高角砲 + 機銃 + 対空電探
  KASUMI_17 = 17,  // 高角砲 + 機銃

  // 鳥海改二/摩耶改二専用
  CHOUKAI_20 = 20, // 高角砲 + 対空電探
  CHOUKAI_21 = 21, // 高角砲

  // 由良改二専用
  YURA_18 = 18,    // 高角砲 + 対空電探

  // 磯風乙改/浜風乙改専用
  ISOKAZE_29 = 29, // 高角砲 + 対空電探 + 対空電探 (実質機銃2?)
  HAMAKAZE_29_ALT = 129, // 別パターン (内部識別用)

  // Fletcher級専用
  FLETCHER_34 = 34, // 5inch単装砲 Mk.30改+GFCS Mk.37×2
  FLETCHER_35 = 35, // 5inch単装砲 Mk.30改+GFCS Mk.37 + 5inch単装砲 Mk.30(改)
  FLETCHER_36 = 36, // 5inch単装砲 Mk.30(改)×2 + GFCS Mk.37
  FLETCHER_37 = 37, // 5inch単装砲 Mk.30(改)×2

  // Atlanta専用
  ATLANTA_38 = 38, // GFCS Mk.37+5inch連装両用砲(集中配備)×2 (電探なし)
  ATLANTA_39 = 39, // GFCS Mk.37+5inch連装両用砲(集中配備) + 5inch連装両用砲(集中配備)
  ATLANTA_40 = 40, // GFCS Mk.37+5inch連装両用砲(集中配備)×2 + 対空電探
  ATLANTA_41 = 41, // GFCS Mk.37+5inch連装両用砲(集中配備) + 5inch連装両用砲(集中配備) + 対空電探

  // 大和型改二専用
  YAMATO_42 = 42,  // 10cm連装高角砲群 集中配備 + 15m二重測距儀+21号電探改二
  YAMATO_43 = 43,  // 10cm連装高角砲群 集中配備 + 対空電探
  YAMATO_44 = 44,  // 10cm連装高角砲群 集中配備×2

  // 榛名改二乙専用
  HARUNA_46 = 46,  // 35.6cm連装砲(ダズル迷彩)改三/四 + 機銃 + 対空電探

  // 秋月型専用 (秋月砲改)
  AKIZUKI_48 = 48, // 10cm連装高角砲改+増設機銃(対水上電探搭載) + 対空電探 or 10cm連装高角砲改+増設機銃×2

  // イギリス艦専用 (汎用)
  BRITISH_32 = 32, // QF 2ポンド8連装ポンポン砲 + 16inch Mk.I三連装砲改
  BRITISH_33 = 33, // 16inch Mk.I三連装砲改 + 機銃
}

// ==================== AACI Info ====================
export interface AaciTypeInfo {
  /** 種別値 */
  id: AaciTypeId;
  /** 固定ボーナス (最低保証撃墜+N) */
  fixedBonus: number;
  /** 変動ボーナス (固定撃墜倍率) */
  variableBonus: number;
  /** 基本発動率 (推定値, 0-1) */
  baseRate: number;
  /** 発動優先度 (大きいほど優先) */
  priority: number;
  /** 説明 */
  description: string;
  /** 対象艦種/艦娘 */
  shipRestriction: AaciShipRestriction;
}

export enum AaciShipRestriction {
  /** 汎用 (潜水艦以外) */
  GENERIC = 'generic',
  /** 秋月型のみ */
  AKIZUKI_CLASS = 'akizuki',
  /** 摩耶改二のみ */
  MAYA_K2 = 'maya_k2',
  /** 伊勢型改二のみ */
  ISE_CLASS_K2 = 'ise_k2',
  /** 武蔵改二のみ */
  MUSASHI_K2 = 'musashi_k2',
  /** 皐月改二/文月改二のみ */
  SATSUKI_FUMIZUKI_K2 = 'satsuki_fumizuki_k2',
  /** 鬼怒改二のみ */
  KINU_K2 = 'kinu_k2',
  /** UIT-25/伊504のみ */
  UIT_I504 = 'uit_i504',
  /** 天龍改二のみ */
  TENRYU_K2 = 'tenryu_k2',
  /** 五十鈴改二のみ */
  ISUZU_K2 = 'isuzu_k2',
  /** 霞改二乙のみ */
  KASUMI_K2B = 'kasumi_k2b',
  /** 由良改二のみ */
  YURA_K2 = 'yura_k2',
  /** 鳥海改二/摩耶改二 */
  CHOUKAI_MAYA_K2 = 'choukai_maya_k2',
  /** 磯風乙改/浜風乙改 */
  ISOKAZE_HAMAKAZE_B = 'isokaze_hamakaze_b',
  /** Fletcher級 */
  FLETCHER_CLASS = 'fletcher',
  /** Atlanta */
  ATLANTA = 'atlanta',
  /** 大和型改二 */
  YAMATO_K2 = 'yamato_k2',
  /** 榛名改二乙 */
  HARUNA_K2B = 'haruna_k2b',
  /** 戦艦のみ */
  BATTLESHIP = 'battleship',
  /** イギリス艦 */
  BRITISH = 'british',
  /** 龍田改二 */
  TATSUTA_K2 = 'tatsuta_k2',
  /** Gotland改/andra */
  GOTLAND_K = 'gotland_k',
}

// ==================== AACI ====================
export const AACI_DATABASE: Map<AaciTypeId, AaciTypeInfo> = new Map([
  // 秋月型専用 (最強クラス)
  [AaciTypeId.AKIZUKI_1, {
    id: AaciTypeId.AKIZUKI_1,
    fixedBonus: 7,
    variableBonus: 1.7,
    baseRate: 0.65,
    priority: 100,
    description: '秋月型: 高角砲×2 + 対空電探',
    shipRestriction: AaciShipRestriction.AKIZUKI_CLASS,
  }],
  [AaciTypeId.AKIZUKI_2, {
    id: AaciTypeId.AKIZUKI_2,
    fixedBonus: 6,
    variableBonus: 1.7,
    baseRate: 0.58,
    priority: 95,
    description: '秋月型: 高角砲 + 対空電探',
    shipRestriction: AaciShipRestriction.AKIZUKI_CLASS,
  }],
  [AaciTypeId.AKIZUKI_3, {
    id: AaciTypeId.AKIZUKI_3,
    fixedBonus: 4,
    variableBonus: 1.6,
    baseRate: 0.50,
    priority: 85,
    description: '秋月型: 高角砲×2',
    shipRestriction: AaciShipRestriction.AKIZUKI_CLASS,
  }],

  // 秋月型専用 (秋月砲改)
  [AaciTypeId.AKIZUKI_48, {
    id: AaciTypeId.AKIZUKI_48,
    fixedBonus: 8,
    variableBonus: 1.7,
    baseRate: 0.65,
    priority: 105,
    description: '秋月型: 10cm連装高角砲改+増設機銃 + 対空電探 or ×2',
    shipRestriction: AaciShipRestriction.AKIZUKI_CLASS,
  }],

  // 摩耶改二専用 (最強クラス)
  [AaciTypeId.MAYA_10, {
    id: AaciTypeId.MAYA_10,
    fixedBonus: 8,
    variableBonus: 1.65,
    baseRate: 0.60,
    priority: 102,
    description: '摩耶改二: 高角砲 + 特殊機銃 + 対空電探',
    shipRestriction: AaciShipRestriction.MAYA_K2,
  }],
  [AaciTypeId.MAYA_11, {
    id: AaciTypeId.MAYA_11,
    fixedBonus: 6,
    variableBonus: 1.5,
    baseRate: 0.55,
    priority: 90,
    description: '摩耶改二: 高角砲 + 特殊機銃',
    shipRestriction: AaciShipRestriction.MAYA_K2,
  }],

  // Atlanta専用 (最強クラス)
  [AaciTypeId.ATLANTA_40, {
    id: AaciTypeId.ATLANTA_40,
    fixedBonus: 10,
    variableBonus: 1.65,
    baseRate: 0.55,
    priority: 108,
    description: 'Atlanta: GFCS砲×2 + 対空電探',
    shipRestriction: AaciShipRestriction.ATLANTA,
  }],
  [AaciTypeId.ATLANTA_41, {
    id: AaciTypeId.ATLANTA_41,
    fixedBonus: 9,
    variableBonus: 1.65,
    baseRate: 0.50,
    priority: 106,
    description: 'Atlanta: GFCS砲 + 集中配備 + 対空電探',
    shipRestriction: AaciShipRestriction.ATLANTA,
  }],
  [AaciTypeId.ATLANTA_38, {
    id: AaciTypeId.ATLANTA_38,
    fixedBonus: 10,
    variableBonus: 1.65,
    baseRate: 0.45,
    priority: 104,
    description: 'Atlanta: GFCS砲×2',
    shipRestriction: AaciShipRestriction.ATLANTA,
  }],
  [AaciTypeId.ATLANTA_39, {
    id: AaciTypeId.ATLANTA_39,
    fixedBonus: 10,
    variableBonus: 1.65,
    baseRate: 0.45,
    priority: 103,
    description: 'Atlanta: GFCS砲 + 集中配備',
    shipRestriction: AaciShipRestriction.ATLANTA,
  }],

  // Fletcher級専用
  [AaciTypeId.FLETCHER_34, {
    id: AaciTypeId.FLETCHER_34,
    fixedBonus: 7,
    variableBonus: 1.6,
    baseRate: 0.60,
    priority: 98,
    description: 'Fletcher級: 5inch Mk.30改+GFCS×2',
    shipRestriction: AaciShipRestriction.FLETCHER_CLASS,
  }],
  [AaciTypeId.FLETCHER_35, {
    id: AaciTypeId.FLETCHER_35,
    fixedBonus: 6,
    variableBonus: 1.55,
    baseRate: 0.55,
    priority: 92,
    description: 'Fletcher級: Mk.30改+GFCS + Mk.30(改)',
    shipRestriction: AaciShipRestriction.FLETCHER_CLASS,
  }],
  [AaciTypeId.FLETCHER_36, {
    id: AaciTypeId.FLETCHER_36,
    fixedBonus: 6,
    variableBonus: 1.55,
    baseRate: 0.55,
    priority: 91,
    description: 'Fletcher級: Mk.30(改)×2 + GFCS',
    shipRestriction: AaciShipRestriction.FLETCHER_CLASS,
  }],
  [AaciTypeId.FLETCHER_37, {
    id: AaciTypeId.FLETCHER_37,
    fixedBonus: 4,
    variableBonus: 1.45,
    baseRate: 0.50,
    priority: 82,
    description: 'Fletcher級: Mk.30(改)×2',
    shipRestriction: AaciShipRestriction.FLETCHER_CLASS,
  }],

  // 大和型改二専用
  [AaciTypeId.YAMATO_42, {
    id: AaciTypeId.YAMATO_42,
    fixedBonus: 10,
    variableBonus: 1.65,
    baseRate: 0.65,
    priority: 107,
    description: '大和型改二: 10cm集中配備 + 15m測距儀+21号改二',
    shipRestriction: AaciShipRestriction.YAMATO_K2,
  }],
  [AaciTypeId.YAMATO_43, {
    id: AaciTypeId.YAMATO_43,
    fixedBonus: 6,
    variableBonus: 1.6,
    baseRate: 0.55,
    priority: 89,
    description: '大和型改二: 10cm集中配備 + 対空電探',
    shipRestriction: AaciShipRestriction.YAMATO_K2,
  }],
  [AaciTypeId.YAMATO_44, {
    id: AaciTypeId.YAMATO_44,
    fixedBonus: 5,
    variableBonus: 1.55,
    baseRate: 0.50,
    priority: 86,
    description: '大和型改二: 10cm集中配備×2',
    shipRestriction: AaciShipRestriction.YAMATO_K2,
  }],

  // 榛名改二乙専用
  [AaciTypeId.HARUNA_46, {
    id: AaciTypeId.HARUNA_46,
    fixedBonus: 8,
    variableBonus: 1.55,
    baseRate: 0.55,
    priority: 101,
    description: '榛名改二乙: ダズル砲改三/四 + 機銃 + 対空電探',
    shipRestriction: AaciShipRestriction.HARUNA_K2B,
  }],

  // 戦艦三式弾
  [AaciTypeId.BB_SANSHIKI_4, {
    id: AaciTypeId.BB_SANSHIKI_4,
    fixedBonus: 6,
    variableBonus: 1.5,
    baseRate: 0.52,
    priority: 88,
    description: '戦艦: 大口径主砲 + 三式弾 + 高射装置 + 対空電探',
    shipRestriction: AaciShipRestriction.BATTLESHIP,
  }],
  [AaciTypeId.BB_SANSHIKI_6, {
    id: AaciTypeId.BB_SANSHIKI_6,
    fixedBonus: 4,
    variableBonus: 1.45,
    baseRate: 0.40,
    priority: 78,
    description: '戦艦: 大口径主砲 + 三式弾 + 高射装置',
    shipRestriction: AaciShipRestriction.BATTLESHIP,
  }],

  // 伊勢型改二専用
  [AaciTypeId.ISE_25, {
    id: AaciTypeId.ISE_25,
    fixedBonus: 7,
    variableBonus: 1.55,
    baseRate: 0.60,
    priority: 97,
    description: '伊勢型改二: 噴進砲改二 + 対空電探 + 三式弾',
    shipRestriction: AaciShipRestriction.ISE_CLASS_K2,
  }],
  [AaciTypeId.ISE_28, {
    id: AaciTypeId.ISE_28,
    fixedBonus: 4,
    variableBonus: 1.4,
    baseRate: 0.55,
    priority: 80,
    description: '伊勢型改二: 噴進砲改二 + 対空電探',
    shipRestriction: AaciShipRestriction.ISE_CLASS_K2,
  }],

  // 武蔵改二専用
  [AaciTypeId.MUSASHI_26, {
    id: AaciTypeId.MUSASHI_26,
    fixedBonus: 6,
    variableBonus: 1.4,
    baseRate: 0.55,
    priority: 93,
    description: '武蔵改二: 10cm高角砲改+増設機銃 + 対空電探',
    shipRestriction: AaciShipRestriction.MUSASHI_K2,
  }],

  // 汎用
  [AaciTypeId.GENERIC_5, {
    id: AaciTypeId.GENERIC_5,
    fixedBonus: 4,
    variableBonus: 1.5,
    baseRate: 0.55,
    priority: 84,
    description: '汎用: 特殊高角砲×2 + 対空電探',
    shipRestriction: AaciShipRestriction.GENERIC,
  }],
  [AaciTypeId.GENERIC_7, {
    id: AaciTypeId.GENERIC_7,
    fixedBonus: 3,
    variableBonus: 1.35,
    baseRate: 0.45,
    priority: 72,
    description: '汎用: 高角砲 + 高射装置 + 対空電探',
    shipRestriction: AaciShipRestriction.GENERIC,
  }],
  [AaciTypeId.GENERIC_8, {
    id: AaciTypeId.GENERIC_8,
    fixedBonus: 4,
    variableBonus: 1.4,
    baseRate: 0.50,
    priority: 76,
    description: '汎用: 高射装置 + 対空電探',
    shipRestriction: AaciShipRestriction.GENERIC,
  }],
  [AaciTypeId.GENERIC_9, {
    id: AaciTypeId.GENERIC_9,
    fixedBonus: 2,
    variableBonus: 1.3,
    baseRate: 0.40,
    priority: 60,
    description: '汎用: 高角砲 + 高射装置',
    shipRestriction: AaciShipRestriction.GENERIC,
  }],
  [AaciTypeId.GENERIC_12, {
    id: AaciTypeId.GENERIC_12,
    fixedBonus: 3,
    variableBonus: 1.25,
    baseRate: 0.50,
    priority: 68,
    description: '汎用: 特殊機銃 + 機銃 + 対空電探',
    shipRestriction: AaciShipRestriction.GENERIC,
  }],

  // 五十鈴改二専用
  [AaciTypeId.ISUZU_14, {
    id: AaciTypeId.ISUZU_14,
    fixedBonus: 4,
    variableBonus: 1.45,
    baseRate: 0.63,
    priority: 81,
    description: '五十鈴改二: 高角砲 + 機銃 + 対空電探',
    shipRestriction: AaciShipRestriction.ISUZU_K2,
  }],

  // 霞改二乙専用
  [AaciTypeId.KASUMI_16, {
    id: AaciTypeId.KASUMI_16,
    fixedBonus: 4,
    variableBonus: 1.4,
    baseRate: 0.62,
    priority: 79,
    description: '霞改二乙: 高角砲 + 機銃 + 対空電探',
    shipRestriction: AaciShipRestriction.KASUMI_K2B,
  }],
  [AaciTypeId.KASUMI_17, {
    id: AaciTypeId.KASUMI_17,
    fixedBonus: 2,
    variableBonus: 1.25,
    baseRate: 0.57,
    priority: 62,
    description: '霞改二乙: 高角砲 + 機銃',
    shipRestriction: AaciShipRestriction.KASUMI_K2B,
  }],

  // 由良改二専用
  [AaciTypeId.YURA_18, {
    id: AaciTypeId.YURA_18,
    fixedBonus: 2,
    variableBonus: 1.2,
    baseRate: 0.59,
    priority: 61,
    description: '由良改二: 高角砲 + 対空電探',
    shipRestriction: AaciShipRestriction.YURA_K2,
  }],

  // 鬼怒改二専用
  [AaciTypeId.KINU_19, {
    id: AaciTypeId.KINU_19,
    fixedBonus: 5,
    variableBonus: 1.45,
    baseRate: 0.55,
    priority: 87,
    description: '鬼怒改二: 高角砲 + 特殊機銃',
    shipRestriction: AaciShipRestriction.KINU_K2,
  }],

  // 鳥海改二/摩耶改二専用
  [AaciTypeId.CHOUKAI_20, {
    id: AaciTypeId.CHOUKAI_20,
    fixedBonus: 3,
    variableBonus: 1.25,
    baseRate: 0.65,
    priority: 70,
    description: '鳥海改二/摩耶改二: 高角砲 + 対空電探',
    shipRestriction: AaciShipRestriction.CHOUKAI_MAYA_K2,
  }],
  [AaciTypeId.CHOUKAI_21, {
    id: AaciTypeId.CHOUKAI_21,
    fixedBonus: 3,
    variableBonus: 1.25,
    baseRate: 0.60,
    priority: 69,
    description: '鳥海改二/摩耶改二: 高角砲',
    shipRestriction: AaciShipRestriction.CHOUKAI_MAYA_K2,
  }],

  // 皐月改二/文月改二専用
  [AaciTypeId.SATSUKI_22, {
    id: AaciTypeId.SATSUKI_22,
    fixedBonus: 2,
    variableBonus: 1.2,
    baseRate: 0.65,
    priority: 58,
    description: '皐月改二/文月改二: 特殊機銃',
    shipRestriction: AaciShipRestriction.SATSUKI_FUMIZUKI_K2,
  }],

  // UIT-25/伊504専用
  [AaciTypeId.UIT_23, {
    id: AaciTypeId.UIT_23,
    fixedBonus: 1,
    variableBonus: 1.05,
    baseRate: 0.80,
    priority: 50,
    description: 'UIT-25/伊504: 通常機銃',
    shipRestriction: AaciShipRestriction.UIT_I504,
  }],

  // 天龍改二専用
  [AaciTypeId.TENRYU_24, {
    id: AaciTypeId.TENRYU_24,
    fixedBonus: 3,
    variableBonus: 1.25,
    baseRate: 0.55,
    priority: 71,
    description: '天龍改二: 高角砲×3',
    shipRestriction: AaciShipRestriction.TENRYU_K2,
  }],

  // 磯風乙改/浜風乙改専用
  [AaciTypeId.ISOKAZE_29, {
    id: AaciTypeId.ISOKAZE_29,
    fixedBonus: 5,
    variableBonus: 1.55,
    baseRate: 0.60,
    priority: 83,
    description: '磯風乙改/浜風乙改: 高角砲 + 対空電探',
    shipRestriction: AaciShipRestriction.ISOKAZE_HAMAKAZE_B,
  }],

  // イギリス艦専用
  [AaciTypeId.BRITISH_32, {
    id: AaciTypeId.BRITISH_32,
    fixedBonus: 3,
    variableBonus: 1.2,
    baseRate: 0.50,
    priority: 67,
    description: 'イギリス艦: ポンポン砲 + 16inch三連装砲改',
    shipRestriction: AaciShipRestriction.BRITISH,
  }],
  [AaciTypeId.BRITISH_33, {
    id: AaciTypeId.BRITISH_33,
    fixedBonus: 3,
    variableBonus: 1.3,
    baseRate: 0.45,
    priority: 66,
    description: 'イギリス艦: 16inch三連装砲改 + 機銃',
    shipRestriction: AaciShipRestriction.BRITISH,
  }],
]);

export function getAaciInfo(typeId: AaciTypeId): AaciTypeInfo | undefined {
  return AACI_DATABASE.get(typeId);
}

export function getAllAaciTypesSorted(): AaciTypeInfo[] {
  return Array.from(AACI_DATABASE.values())
    .sort((a, b) => b.priority - a.priority);
}

