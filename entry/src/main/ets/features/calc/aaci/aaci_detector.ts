import {
  isSubmarine,
  isAkizukiClass,
  isMayaK2,
  isAtlanta,
  isFletcherClass,
  isYamatoK2,
  isHarunaK2B,
  isIseClassK2,
  isMusashiK2,
  isIsuzuK2,
  isKasumiK2B,
  isSatsukiOrFumizukiK2,
  isKinuK2,
  isYuraK2,
  isBritish,
  isBattleship
} from ".";
import { SlotItemMaster } from "../../../domain/models";
import { AaciTypeId, AaciTypeInfo, getAaciInfo } from "./aaci_types";
import {
  countEquipment,
  isHighAngleGun,
  hasEquipment,
  isAirRadar,
  isAirRadarAtLeast,
  isSpecialAAGun,
  isAtlantaGFCSMount,
  isAtlantaCentralizedGun,
  isMk30KaiGFCS,
  isMk30Kai,
  is10cmCentralizedMount,
  isYamatoRadar,
  isRocketLauncherK2,
  isSanshikidan,
  isDazzleGunK3K4,
  isAAGun,
  isLargeMainGun,
  isAADirector,
  isBuiltInAAFD,
  isSpecialHighAngleGun,
  isPomPomGun,
  is16inchMkIGunKai,
  is10cmHighAngleGunKai,
  is10cmHighAngleGunKaiDirectorKai,
  isType94AADirector,
  isAAGunAtLeast
} from "./equip_helper";
import {
  isChoukaiOrMayaK2,
  isFubukiAaciGroup,
  isFubukiKai3,
  isFubukiKai3Go,
  isIsokazeOrHamakazeB,
  isTenryuK2,
  isUitOrI504
} from "./ship_helper";

// ==================== Type Detect ====================
export interface DetectedAaci {
  /** AACI 種別 */
  typeId: AaciTypeId;
  /** AACI 情報 */
  info: AaciTypeInfo;
}

export interface ShipAaciResult {
  /** 艦娘 UID */
  shipUid: number;
  /** 艦娘 Master ID */
  shipMasterId: number;
  /** 検出された全 AACI (優先度順) */
  detectedAacis: DetectedAaci[];
  /** 最優先の AACI */
  primaryAaci?: DetectedAaci;
}

// ==================== Equip check ====================


/**
 * 秋月型専用 AACI の装備条件
 */
function checkAkizukiAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const haGunCount = countEquipment(equips, isHighAngleGun);
  const hasRadar = hasEquipment(equips, isAirRadar);
  const akizukiGunKaiDirectorCount = countEquipment(equips, is10cmHighAngleGunKaiDirectorKai);
  const hasAa4Radar = hasEquipment(equips, m => isAirRadarAtLeast(m, 4));

  // 48種: 10cm連装高角砲改+高射装置改×2 + 対空電探(素対空4以上)
  if (akizukiGunKaiDirectorCount >= 2 && hasAa4Radar) {
    result.push(AaciTypeId.AKIZUKI_48);
  }

  // 1種: 高角砲×2 + 対空電探
  if (haGunCount >= 2 && hasRadar) {
    result.push(AaciTypeId.AKIZUKI_1);
  }

  // 2種: 高角砲 + 対空電探
  if (haGunCount >= 1 && hasRadar) {
    result.push(AaciTypeId.AKIZUKI_2);
  }

  // 3種: 高角砲×2
  if (haGunCount >= 2) {
    result.push(AaciTypeId.AKIZUKI_3);
  }

  return result;
}

/**
 * 摩耶改二専用 AACI の装備条件
 */
function checkMayaK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasHaGun = hasEquipment(equips, isHighAngleGun);
  const hasSpecialMg = hasEquipment(equips, isSpecialAAGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 10種: 高角砲 + 特殊機銃 + 対空電探
  if (hasHaGun && hasSpecialMg && hasRadar) {
    result.push(AaciTypeId.MAYA_10);
  }

  // 11種: 高角砲 + 特殊機銃
  if (hasHaGun && hasSpecialMg) {
    result.push(AaciTypeId.MAYA_11);
  }

  return result;
}

/**
 * Atlanta専用 AACI の装備条件
 */
function checkAtlantaAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const gfcsMountCount = countEquipment(equips, isAtlantaGFCSMount);
  const centralizedCount = countEquipment(equips, isAtlantaCentralizedGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 40種: GFCS砲×2 + 対空電探
  if (gfcsMountCount >= 2 && hasRadar) {
    result.push(AaciTypeId.ATLANTA_40);
  }

  // 41種: GFCS砲 + 集中配備 + 対空電探
  if (gfcsMountCount >= 1 && centralizedCount >= 2 && hasRadar) {
    result.push(AaciTypeId.ATLANTA_41);
  }

  // 38種: GFCS砲×2
  if (gfcsMountCount >= 2) {
    result.push(AaciTypeId.ATLANTA_38);
  }

  // 39種: GFCS砲 + 集中配備
  if (gfcsMountCount >= 1 && centralizedCount >= 2) {
    result.push(AaciTypeId.ATLANTA_39);
  }

  return result;
}

/**
 * Fletcher級専用 AACI の装備条件
 */
function checkFletcherAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const mk30KaiGfcsCount = countEquipment(equips, isMk30KaiGFCS);
  const mk30KaiCount = countEquipment(equips, isMk30Kai);
  const hasGFCS = hasEquipment(equips, m => m.id === 307); // GFCS Mk.37

  // 34種: Mk.30改+GFCS×2
  if (mk30KaiGfcsCount >= 2) {
    result.push(AaciTypeId.FLETCHER_34);
  }

  // 35種: Mk.30改+GFCS + Mk.30(改)
  if (mk30KaiGfcsCount >= 1 && mk30KaiCount >= 1) {
    result.push(AaciTypeId.FLETCHER_35);
  }

  // 36種: Mk.30(改)×2 + GFCS
  if (mk30KaiCount >= 2 && hasGFCS) {
    result.push(AaciTypeId.FLETCHER_36);
  }

  // 37種: Mk.30(改)×2
  if (mk30KaiCount >= 2) {
    result.push(AaciTypeId.FLETCHER_37);
  }

  return result;
}

/**
 * 吹雪改三護が共有する秋月型/Fletcher級 AACI の装備条件
 */
function checkFubukiKai3GoSharedAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const specialHaGunCount = countEquipment(equips, isSpecialHighAngleGun);
  const hasRadar = hasEquipment(equips, isAirRadar);
  const akizukiGunKaiDirectorCount = countEquipment(equips, is10cmHighAngleGunKaiDirectorKai);
  const hasAa4Radar = hasEquipment(equips, m => isAirRadarAtLeast(m, 4));
  const mk30KaiGfcsCount = countEquipment(equips, isMk30KaiGFCS);
  const mk30KaiCount = countEquipment(equips, isMk30Kai);
  const hasGFCS = hasEquipment(equips, m => m.id === 307);

  // 2種: 特殊高角砲 + 対空電探
  if (specialHaGunCount >= 1 && hasRadar) {
    result.push(AaciTypeId.AKIZUKI_2);
  }

  // 48種: 10cm連装高角砲改+高射装置改×2 + 対空電探(素対空4以上)
  if (akizukiGunKaiDirectorCount >= 2 && hasAa4Radar) {
    result.push(AaciTypeId.AKIZUKI_48);
  }

  // 34種: Mk.30改+GFCS×2
  if (mk30KaiGfcsCount >= 2) {
    result.push(AaciTypeId.FLETCHER_34);
  }

  // 35種: Mk.30改+GFCS + Mk.30(改)
  if (mk30KaiGfcsCount >= 1 && mk30KaiCount >= 1) {
    result.push(AaciTypeId.FLETCHER_35);
  }

  // 36種: Mk.30(改)×2 + GFCS
  if (mk30KaiCount >= 2 && hasGFCS) {
    result.push(AaciTypeId.FLETCHER_36);
  }

  return result;
}

/**
 * 吹雪改二/改三/改三護などの新規 AACI の装備条件
 */
function checkFubukiGroupAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const specialHaGunCount = countEquipment(equips, isSpecialHighAngleGun);
  const hasAa4Radar = hasEquipment(equips, m => isAirRadarAtLeast(m, 4));
  const kaiGunCount = countEquipment(equips, is10cmHighAngleGunKai);
  const plainKaiGunCount = countEquipment(equips, m =>
    is10cmHighAngleGunKai(m) && !is10cmHighAngleGunKaiDirectorKai(m)
  );
  const hasType94Aafd = hasEquipment(equips, isType94AADirector);
  const hasAa5MachineGun = hasEquipment(equips, m => isAAGunAtLeast(m, 5));

  // 49種: 特殊高角砲×2 + 対空電探(素対空4以上)
  if (specialHaGunCount >= 2 && hasAa4Radar) {
    result.push(AaciTypeId.FUBUKI_49);
  }

  // 50種: 10cm連装高角砲改系×2 + 対空電探(素対空4以上) + 94式高射装置
  if (kaiGunCount >= 2 && hasAa4Radar && hasType94Aafd) {
    result.push(AaciTypeId.FUBUKI_50);
  }

  // 51種: 10cm連装高角砲改系 + 対空電探(素対空4以上) + 機銃(素対空5以上)
  if (kaiGunCount >= 1 && hasAa4Radar && hasAa5MachineGun) {
    result.push(AaciTypeId.FUBUKI_51);
  }

  // 52種: 10cm連装高角砲改×2 + 94式高射装置
  if (plainKaiGunCount >= 2 && hasType94Aafd) {
    result.push(AaciTypeId.FUBUKI_52);
  }

  return result;
}

/**
 * 大和型改二専用 AACI の装備条件
 */
function checkYamatoK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const centralizedCount = countEquipment(equips, is10cmCentralizedMount);
  const hasYamatoRadar = hasEquipment(equips, isYamatoRadar);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 42種: 10cm集中配備 + 15m測距儀+21号改二
  if (centralizedCount >= 1 && hasYamatoRadar) {
    result.push(AaciTypeId.YAMATO_42);
  }

  // 43種: 10cm集中配備 + 対空電探
  if (centralizedCount >= 1 && hasRadar) {
    result.push(AaciTypeId.YAMATO_43);
  }

  // 44種: 10cm集中配備×2
  if (centralizedCount >= 2) {
    result.push(AaciTypeId.YAMATO_44);
  }

  return result;
}

/**
 * 伊勢型改二専用 AACI の装備条件
 */
function checkIseK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasRocketK2 = hasEquipment(equips, isRocketLauncherK2);
  const hasRadar = hasEquipment(equips, isAirRadar);
  const hasSanshiki = hasEquipment(equips, isSanshikidan);

  // 25種: 噴進砲改二 + 対空電探 + 三式弾
  if (hasRocketK2 && hasRadar && hasSanshiki) {
    result.push(AaciTypeId.ISE_25);
  }

  // 28種: 噴進砲改二 + 対空電探
  if (hasRocketK2 && hasRadar) {
    result.push(AaciTypeId.ISE_28);
  }

  return result;
}

/**
 * 武蔵改二専用 AACI の装備条件
 */
function checkMusashiK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasBuiltInGun = hasEquipment(equips, m => m.id === 275); // 10cm連装高角砲改+増設機銃
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 26種: 10cm高角砲改+増設機銃 + 対空電探
  if (hasBuiltInGun && hasRadar) {
    result.push(AaciTypeId.MUSASHI_26);
  }

  return result;
}

/**
 * 榛名改二乙専用 AACI の装備条件
 */
function checkHarunaK2BAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasDazzleGun = hasEquipment(equips, isDazzleGunK3K4);
  const hasMg = hasEquipment(equips, isAAGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 46種: ダズル砲改三/四 + 機銃 + 対空電探
  if (hasDazzleGun && hasMg && hasRadar) {
    result.push(AaciTypeId.HARUNA_46);
  }

  return result;
}

/**
 * 戦艦三式弾 AACI の装備条件
 */
function checkBattleshipSanshikiAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasLargeGun = hasEquipment(equips, isLargeMainGun);
  const hasSanshiki = hasEquipment(equips, isSanshikidan);
  const hasAafd = hasEquipment(equips, m => isAADirector(m) || isBuiltInAAFD(m));
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 4種: 大口径主砲 + 三式弾 + 高射装置 + 対空電探
  if (hasLargeGun && hasSanshiki && hasAafd && hasRadar) {
    result.push(AaciTypeId.BB_SANSHIKI_4);
  }

  // 6種: 大口径主砲 + 三式弾 + 高射装置
  if (hasLargeGun && hasSanshiki && hasAafd) {
    result.push(AaciTypeId.BB_SANSHIKI_6);
  }

  return result;
}

/**
 * 汎用 AACI の装備条件
 */
function checkGenericAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const specialHaGunCount = countEquipment(equips, isSpecialHighAngleGun);
  const haGunCount = countEquipment(equips, isHighAngleGun);
  const hasAafd = hasEquipment(equips, m => isAADirector(m) || isBuiltInAAFD(m));
  const pureAafd = hasEquipment(equips, isAADirector);
  const hasRadar = hasEquipment(equips, isAirRadar);
  const specialMgCount = countEquipment(equips, isSpecialAAGun);
  const mgCount = countEquipment(equips, isAAGun);

  // 5種: 特殊高角砲×2 + 対空電探
  if (specialHaGunCount >= 2 && hasRadar) {
    result.push(AaciTypeId.GENERIC_5);
  }

  // 8種: 高射装置 + 対空電探
  if (pureAafd && hasRadar) {
    result.push(AaciTypeId.GENERIC_8);
  }

  // 7種: 高角砲 + 高射装置 + 対空電探
  if (haGunCount >= 1 && hasAafd && hasRadar) {
    result.push(AaciTypeId.GENERIC_7);
  }

  // 9種: 高角砲 + 高射装置
  if (haGunCount >= 1 && hasAafd) {
    result.push(AaciTypeId.GENERIC_9);
  }

  // 12種: 特殊機銃 + 機銃 + 対空電探
  if (specialMgCount >= 1 && mgCount >= 2 && hasRadar) {
    result.push(AaciTypeId.GENERIC_12);
  }

  return result;
}

/**
 * 五十鈴改二専用 AACI の装備条件
 */
function checkIsuzuK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasHaGun = hasEquipment(equips, isHighAngleGun);
  const hasMg = hasEquipment(equips, isAAGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 14種: 高角砲 + 機銃 + 対空電探
  if (hasHaGun && hasMg && hasRadar) {
    result.push(AaciTypeId.ISUZU_14);
  }

  return result;
}

/**
 * 霞改二乙専用 AACI の装備条件
 */
function checkKasumiK2BAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasHaGun = hasEquipment(equips, isHighAngleGun);
  const hasMg = hasEquipment(equips, isAAGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 16種: 高角砲 + 機銃 + 対空電探
  if (hasHaGun && hasMg && hasRadar) {
    result.push(AaciTypeId.KASUMI_16);
  }

  // 17種: 高角砲 + 機銃
  if (hasHaGun && hasMg) {
    result.push(AaciTypeId.KASUMI_17);
  }

  return result;
}

/**
 * 皐月改二/文月改二専用 AACI の装備条件
 */
function checkSatsukiFumizukiK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasSpecialMg = hasEquipment(equips, isSpecialAAGun);

  // 22種: 特殊機銃
  if (hasSpecialMg) {
    result.push(AaciTypeId.SATSUKI_22);
  }

  return result;
}

/**
 * 鬼怒改二専用 AACI の装備条件
 */
function checkKinuK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  // 高角砲 (高射装置一体型以外)
  const hasNonBuiltInHaGun = hasEquipment(equips, m =>
  isHighAngleGun(m) && !isBuiltInAAFD(m)
  );
  const hasSpecialMg = hasEquipment(equips, isSpecialAAGun);

  // 19種: 高角砲(非高射装置) + 特殊機銃
  if (hasNonBuiltInHaGun && hasSpecialMg) {
    result.push(AaciTypeId.KINU_19);
  }

  return result;
}

/**
 * 鳥海改二/摩耶改二専用 AACI の装備条件
 */
function checkChoukaiMayaK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasHaGun = hasEquipment(equips, isHighAngleGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 20種: 高角砲 + 対空電探
  if (hasHaGun && hasRadar) {
    result.push(AaciTypeId.CHOUKAI_20);
  }

  return result;
}

/**
 * 由良改二/吹雪改三/吹雪改三護専用 AACI の装備条件
 */
function checkYuraFubukiKai3AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasHaGun = hasEquipment(equips, isHighAngleGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 21種: 高角砲 + 対空電探
  if (hasHaGun && hasRadar) {
    result.push(AaciTypeId.YURA_FUBUKI_21);
  }

  return result;
}

/**
 * 磯風乙改/浜風乙改専用 AACI の装備条件
 */
function checkIsokazeHamazakeBaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasHaGun = hasEquipment(equips, isHighAngleGun);
  const hasRadar = hasEquipment(equips, isAirRadar);

  // 29種: 高角砲 + 対空電探
  if (hasHaGun && hasRadar) {
    result.push(AaciTypeId.ISOKAZE_29);
  }

  return result;
}

/**
 * 天龍改二専用 AACI の装備条件
 */
function checkTenryuK2AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const haGunCount = countEquipment(equips, isHighAngleGun);

  // 24種: 高角砲×3
  if (haGunCount >= 3) {
    result.push(AaciTypeId.TENRYU_24);
  }

  return result;
}

/**
 * UIT-25/伊504専用 AACI の装備条件
 */
function checkUitI504AaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasMg = hasEquipment(equips, isAAGun);

  // 23種: 通常機銃
  if (hasMg) {
    result.push(AaciTypeId.UIT_23);
  }

  return result;
}

/**
 * イギリス艦専用 AACI の装備条件
 */
function checkBritishAaciConditions(
  equips: SlotItemMaster[]
): AaciTypeId[] {
  const result: AaciTypeId[] = [];

  const hasPomPom = hasEquipment(equips, isPomPomGun);
  const has16inch = hasEquipment(equips, is16inchMkIGunKai);
  const hasMg = hasEquipment(equips, isAAGun);

  // 32種: ポンポン砲 + 16inch三連装砲改
  if (hasPomPom && has16inch) {
    result.push(AaciTypeId.BRITISH_32);
  }

  // 33種: 16inch三連装砲改 + 機銃
  if (has16inch && hasMg) {
    result.push(AaciTypeId.BRITISH_33);
  }

  return result;
}

// ===============================================================
/**
 * 艦娘と装備から発動可能な AACI を全て検出
 *
 * @param shipMasterId 艦娘 Master ID
 * @param stype 艦種
 * @param ctype 艦型
 * @param equips 装備一覧 (Master データ)
 * @returns 検出された AACI 種別一覧 (優先度順)
 */
export function detectAacis(
  shipMasterId: number,
  stype: number,
  ctype: number,
  equips: SlotItemMaster[]
): DetectedAaci[] {
  const detected: AaciTypeId[] = [];

  // 潜水艦は対空カットイン不可
  if (isSubmarine(stype)) {
    return [];
  }

  // 艦娘固有チェック
  if (isAkizukiClass(shipMasterId)) {
    detected.push(...checkAkizukiAaciConditions(equips));
  }

  if (isMayaK2(shipMasterId)) {
    detected.push(...checkMayaK2AaciConditions(equips));
  }

  if (isAtlanta(shipMasterId)) {
    detected.push(...checkAtlantaAaciConditions(equips));
  }

  if (isFletcherClass(shipMasterId)) {
    detected.push(...checkFletcherAaciConditions(equips));
  }

  if (isFubukiKai3Go(shipMasterId)) {
    detected.push(...checkFubukiKai3GoSharedAaciConditions(equips));
  }

  if (isFubukiAaciGroup(shipMasterId)) {
    detected.push(...checkFubukiGroupAaciConditions(equips));
  }

  if (isYamatoK2(shipMasterId)) {
    detected.push(...checkYamatoK2AaciConditions(equips));
  }

  if (isHarunaK2B(shipMasterId)) {
    detected.push(...checkHarunaK2BAaciConditions(equips));
  }

  if (isIseClassK2(shipMasterId)) {
    detected.push(...checkIseK2AaciConditions(equips));
  }

  if (isMusashiK2(shipMasterId)) {
    detected.push(...checkMusashiK2AaciConditions(equips));
  }

  if (isIsuzuK2(shipMasterId)) {
    detected.push(...checkIsuzuK2AaciConditions(equips));
  }

  if (isKasumiK2B(shipMasterId)) {
    detected.push(...checkKasumiK2BAaciConditions(equips));
  }

  if (isSatsukiOrFumizukiK2(shipMasterId)) {
    detected.push(...checkSatsukiFumizukiK2AaciConditions(equips));
  }

  if (isKinuK2(shipMasterId)) {
    detected.push(...checkKinuK2AaciConditions(equips));
  }

  if (isChoukaiOrMayaK2(shipMasterId)) {
    detected.push(...checkChoukaiMayaK2AaciConditions(equips));
  }

  if (isYuraK2(shipMasterId) || isFubukiKai3(shipMasterId)) {
    detected.push(...checkYuraFubukiKai3AaciConditions(equips));
  }

  if (isIsokazeOrHamakazeB(shipMasterId)) {
    detected.push(...checkIsokazeHamazakeBaciConditions(equips));
  }

  if (isTenryuK2(shipMasterId)) {
    detected.push(...checkTenryuK2AaciConditions(equips));
  }

  if (isUitOrI504(shipMasterId)) {
    detected.push(...checkUitI504AaciConditions(equips));
  }

  if (isBritish(ctype)) {
    detected.push(...checkBritishAaciConditions(equips));
  }

  // 戦艦三式弾
  if (isBattleship(stype)) {
    detected.push(...checkBattleshipSanshikiAaciConditions(equips));
  }

  // 汎用 AACI (全艦種)
  detected.push(...checkGenericAaciConditions(equips));

  const uniqueTypes = [...new Set(detected)];
  const result: DetectedAaci[] = [];

  for (const typeId of uniqueTypes) {
    const info = getAaciInfo(typeId);
    if (info) {
      result.push({ typeId, info });
    }
  }

  result.sort((a, b) => b.info.priority - a.info.priority);

  return result;
}

export function detectShipAaci(
  shipUid: number,
  shipMasterId: number,
  stype: number,
  ctype: number,
  equips: SlotItemMaster[]
): ShipAaciResult {
  const detectedAacis = detectAacis(shipMasterId, stype, ctype, equips);

  return {
    shipUid,
    shipMasterId,
    detectedAacis,
    primaryAaci: detectedAacis[0],
  };
}
