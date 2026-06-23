/**
 * AACI Module
 *
 * 対空カットイン
 */

// 型定義
export {
  AaciTypeId,
  AaciTypeInfo,
  AaciShipRestriction,
  AACI_DATABASE,
  getAaciInfo,
  getAllAaciTypesSorted,
} from './aaci_types';

export {
  isHighAngleGun,
  isSpecialHighAngleGun,
  isAADirector,
  isBuiltInAAFD,
  isAirRadar,
  isAirRadarAtLeast,
  isAAGun,
  isAAGunAtLeast,
  isSpecialAAGun,
  isSanshikidan,
  isLargeMainGun,
  isMainGun,
  isAkizukiGun,
  isRocketLauncherK2,
  is10cmCentralizedMount,
  is10cmHighAngleGunKai,
  is10cmHighAngleGunKaiDirectorKai,
  isType94AADirector,
  isYamatoRadar,
  isC3HMainGun,
  is25mmAAGunZoubi,
  countEquipment,
  findEquipment,
  hasEquipment,
} from './equip_helper';

export {
  isAkizukiClass,
  isMayaK2,
  isChoukaiK2,
  isIseClassK2,
  isMusashiK2,
  isYamatoK2,
  isSatsukiOrFumizukiK2,
  isKinuK2,
  isIsuzuK2,
  isKasumiK2B,
  isYuraK2,
  isFubukiKai3,
  isFubukiKai3Go,
  isFubukiAaciGroup,
  isShiratsuyuC3HAaciGroup,
  isFletcherClass,
  isAtlanta,
  isHarunaK2B,
  isBattleship,
  isSubmarine,
  isBritish,
  matchesShipRestriction,
} from './ship_helper';

export {
  DetectedAaci,
  ShipAaciResult,
  detectAacis,
  detectShipAaci,
} from './aaci_detector';

export {
  calcSingleAaciRate,
  calcCombinedAaciRate,
  RADAR_RATE_BONUS,
  FLAGSHIP_RATE_BONUS,
  LUCK_RATE_COEFFICIENT,
} from './aaci_rate';
