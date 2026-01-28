/**
 * 稀有度枚举 (api_backs / api_rare)
 */
export enum Rarity {
  /** 藍 - Common */
  COMMON = 1,
  /** 青 - Uncommon */
  UNCOMMON = 2,
  /** 水 - Rare */
  RARE = 3,
  /** 銀 - Rare+ */
  RARE_PLUS = 4,
  /** 金 - Super Rare */
  SR = 5,
  /** 虹 - Super Super Rare */
  SSR = 6,
  /** 輝虹 - Holo */
  HOLO = 7,
  /** 桜虹 - Sakura Holo */
  SAKURA = 8,
}

/** 稀有度背景颜色 (Hex) */
export const RarityColor: Record<Rarity, string> = {
  [Rarity.COMMON]: '#8888AA',      // 藍
  [Rarity.UNCOMMON]: '#6699BB',    // 青
  [Rarity.RARE]: '#66AACC',        // 水
  [Rarity.RARE_PLUS]: '#AAAAAA',   // 銀
  [Rarity.SR]: '#CCAA55',          // 金
  [Rarity.SSR]: '#AA88CC',         // 虹
  [Rarity.HOLO]: '#CCAAEE',        // 輝虹
  [Rarity.SAKURA]: '#FFAACC',      // 桜虹
};

/** 稀有度名称 */
export const RarityName: Record<Rarity, string> = {
  [Rarity.COMMON]: '藍',
  [Rarity.UNCOMMON]: '青',
  [Rarity.RARE]: '水',
  [Rarity.RARE_PLUS]: '銀',
  [Rarity.SR]: '金',
  [Rarity.SSR]: '虹',
  [Rarity.HOLO]: '輝虹',
  [Rarity.SAKURA]: '桜虹',
};

/** 获取稀有度星级数量 */
export function getRarityStars(rarity: Rarity): number {
  switch (rarity) {
    case Rarity.COMMON: return 1;
    case Rarity.UNCOMMON: return 2;
    case Rarity.RARE: return 3;
    case Rarity.RARE_PLUS: return 4;
    case Rarity.SR: return 5;
    case Rarity.SSR: return 6;
    case Rarity.HOLO: return 7;
    case Rarity.SAKURA: return 8;
    default: return 0;
  }
}
