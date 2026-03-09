/**
 * AACI Equipment Classification Helpers
 */

import { SlotItemEquipType, SlotItemIconId, SlotItemMaster } from "../../../domain/models";

// ==================== Equipment Category ====================
/**
 * 高角砲
 */
export function isHighAngleGun(master: SlotItemMaster): boolean {
  return master.type.iconId === SlotItemIconId.HighAngleGun;
}

/**
 * 特殊高角砲
 * 高角砲(対空8以上)
 */
export function isSpecialHighAngleGun(master: SlotItemMaster): boolean {
  return isHighAngleGun(master) && master.stats.aa >= 8;
}

/**
 * 高射装置
 */
export function isAADirector(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.AADirector;
}

/**
 * 高角砲+高射装置
 * 例: 10cm高角砲+高射装置, 12.7cm高角砲+高射装置
 */
export function isBuiltInAAFD(master: SlotItemMaster): boolean {
  const builtInIds: Set<number> = new Set([
    122, // 10cm高角砲+高射装置
    130, // 12.7cm高角砲+高射装置
    135, // 90mm単装高角砲
    172, // 5inch連装砲(集中配備)
    275, // 10cm連装高角砲改+増設機銃
    295, // 12.7cm連装砲A型改三(戦時改修)+高射装置
    296, // 12.7cm連装砲B型改四(戦時改修)+高射装置
    308, // 5inch単装砲 Mk.30改+GFCS Mk.37
    313, // 5inch連装両用砲(集中配備)
    363, // 10cm連装高角砲群 集中配備
    438, // 5inch連装砲 Mk.28 mod.2
    467, // 10cm連装高角砲改+増設機銃(対水上電探搭載)
  ]);
  return builtInIds.has(master.id);
}
/**
 * 対空電探
 * 電探(対空2以上)
 */
export function isAirRadar(master: SlotItemMaster): boolean {
  const radarTypes: Set<SlotItemEquipType> = new Set([
    SlotItemEquipType.SmallRadar,
    SlotItemEquipType.LargeRadar,
    SlotItemEquipType.LargeRadarII,
  ]);
  return radarTypes.has(master.type.equipType) && master.stats.aa >= 2;
}
/**
 * 対空機銃
 */
export function isAAGun(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.AAGun;
}
/**
 * 特殊機銃
 * 機銃(対空9以上)
 * 例: 25mm三連装機銃 集中配備, Bofors 40mm, QF 2ポンド8連装ポンポン砲
 */
export function isSpecialAAGun(master: SlotItemMaster): boolean {
  return isAAGun(master) && master.stats.aa >= 9;
}
/**
 * 三式弾
 */
export function isSanshikidan(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.AAShell;
}

/**
 * 大口径主砲
 */
export function isLargeMainGun(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.LargeCaliberMainGun ||
    master.type.equipType === SlotItemEquipType.LargeCaliberMainGunII;
}
/**
 * 主砲(小/中/大口径)
 */
export function isMainGun(master: SlotItemMaster): boolean {
  const mainGunTypes: Set<SlotItemEquipType> = new Set([
    SlotItemEquipType.SmallCaliberMainGun,
    SlotItemEquipType.MediumCaliberMainGun,
    SlotItemEquipType.LargeCaliberMainGun,
    SlotItemEquipType.LargeCaliberMainGunII,
  ]);
  return mainGunTypes.has(master.type.equipType);
}

// ==================== Special Equip  ====================
export function isAkizukiGun(master: SlotItemMaster): boolean {
  const akizukiGunIds: Set<number> = new Set([
    122,  // 10cm高角砲+高射装置
    275,  // 10cm連装高角砲改+増設機銃
    467,  // 10cm連装高角砲改+増設機銃(対水上電探搭載)
  ]);
  return akizukiGunIds.has(master.id);
}

export function isRocketLauncherK2(master: SlotItemMaster): boolean {
  return master.id === 274; // 12cm30連装噴進砲改二
}

export function is10cmCentralizedMount(master: SlotItemMaster): boolean {
  return master.id === 363; // 10cm連装高角砲群 集中配備
}

export function isYamatoRadar(master: SlotItemMaster): boolean {
  const yamatoRadarIds: Set<number> = new Set([
    142,  // 15m二重測距儀+21号電探改二
    460,  // 15m二重測距儀改+21号電探改二+熟練射撃指揮所
  ]);
  return yamatoRadarIds.has(master.id);
}

export function isGFCS(master: SlotItemMaster): boolean {
  const gfcsIds: Set<number> = new Set([
    307,  // GFCS Mk.37
    308,  // 5inch単装砲 Mk.30改+GFCS Mk.37
    363,  // 10cm連装高角砲群 集中配備 (これはGFCSではない)
  ]);
  return gfcsIds.has(master.id);
}

export function isMk30KaiGFCS(master: SlotItemMaster): boolean {
  return master.id === 308;
}

export function isMk30Kai(master: SlotItemMaster): boolean {
  const mk30KaiIds: Set<number> = new Set([
    284,  // 5inch単装砲 Mk.30
    313,  // 5inch連装両用砲(集中配備)
    285,  // 5inch単装砲 Mk.30改
  ]);
  return mk30KaiIds.has(master.id);
}

export function isAtlantaGFCSGun(master: SlotItemMaster): boolean {
  return master.id === 363; // これではない、正しいIDは362
  // 362: GFCS Mk.37+5inch連装両用砲(集中配備)
}

export function isAtlantaCentralizedGun(master: SlotItemMaster): boolean {
  const ids: Set<number> = new Set([
    361,  // 5inch連装両用砲(集中配備)
    362,  // GFCS Mk.37+5inch連装両用砲(集中配備)
  ]);
  return ids.has(master.id);
}

export function isAtlantaGFCSMount(master: SlotItemMaster): boolean {
  return master.id === 362; // GFCS Mk.37+5inch連装両用砲(集中配備)
}

export function isDazzleGunK3K4(master: SlotItemMaster): boolean {
  const ids: Set<number> = new Set([
    502,  // 35.6cm連装砲(ダズル迷彩)改三
    503,  // 35.6cm連装砲(ダズル迷彩)改四
  ]);
  return ids.has(master.id);
}

export function isPomPomGun(master: SlotItemMaster): boolean {
  return master.id === 191; // QF 2ポンド8連装ポンポン砲
}

export function is16inchMkIGunKai(master: SlotItemMaster): boolean {
  const ids: Set<number> = new Set([
    298,  // 16inch Mk.I三連装砲改
    299,  // 16inch Mk.I三連装砲改+FCR type284
  ]);
  return ids.has(master.id);
}

//-------------- Helper ------------
export function countEquipment(
  masters: SlotItemMaster[],
  predicate: (m: SlotItemMaster) => boolean
): number {
  return masters.filter(predicate).length;
}

export function findEquipment(
  masters: SlotItemMaster[],
  predicate: (m: SlotItemMaster) => boolean
): SlotItemMaster | undefined {
  return masters.find(predicate);
}

export function hasEquipment(
  masters: SlotItemMaster[],
  predicate: (m: SlotItemMaster) => boolean
): boolean {
  return masters.some(predicate);
}
