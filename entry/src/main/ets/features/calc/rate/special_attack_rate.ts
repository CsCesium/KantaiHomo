/**
 * Battleship Special Attack (特殊攻撃) Activation Rate Calculator
 *
 * Calculates activation rates for various special attacks:
 * - Nelson Touch
 * - Nagato/Mutsu Touch (長門型一斉射)
 * - Colorado Touch
 * - Richelieu Touch
 * - Warspite/Valiant Touch
 * - Yamato Touch (大和型特殊攻撃)
 * - Kongou Night Attack (僚艦夜戦突撃)
 *
 * Reference: https://wikiwiki.jp/kancolle/Nelson
 * Reference: https://zekamashi.net/kancolle-kouryaku/nagato-skill/
 */

import {
  Formation,
  FleetType,
  DamageState,
  clampRate,
  MAX_RATE,
} from './rate_types';
import {
  ShipType,
  isBattleshipType,
  isCarrierType,
  isSubmarineType,
} from '../../../domain/models';

// ==================== Special Attack Types ====================

/**
 * Special attack type
 */
export enum SpecialAttackType {
  /** ネルソンタッチ - Nelson Touch */
  NelsonTouch = 'nelson_touch',
  /** 長門タッチ - Nagato Touch */
  NagatoTouch = 'nagato_touch',
  /** 陸奥タッチ - Mutsu Touch */
  MutsuTouch = 'mutsu_touch',
  /** コロラドタッチ - Colorado Touch */
  ColoradoTouch = 'colorado_touch',
  /** リシュリュータッチ - Richelieu Touch */
  RichelieuTouch = 'richelieu_touch',
  /** ウォースパイトタッチ - Warspite Touch */
  WarspiteTouch = 'warspite_touch',
  /** 大和タッチ(2隻) - Yamato Touch (2 ships) */
  YamatoTouch2 = 'yamato_touch_2',
  /** 大和タッチ(3隻) - Yamato Touch (3 ships) */
  YamatoTouch3 = 'yamato_touch_3',
  /** 僚艦夜戦突撃 - Kongou Night Attack */
  KongouNightAttack = 'kongou_night_attack',
  /** 潜水艦隊攻撃 - Submarine Fleet Attack */
  SubmarineFleetAttack = 'submarine_fleet_attack',
}

/**
 * Ship positions involved in special attack
 */
export interface SpecialAttackPositions {
  /** Type determines which positions are used */
  type: SpecialAttackType;
  /** Position pattern: 1-3-5 (Nelson), 1-2 (Nagato), 1-2-3 (Colorado/Yamato) */
  positions: number[];
}

export interface SpecialAttackFleetShip {
  uid?: number;
  masterId: number;
  stype?: number;
  level?: number;
  hpNow?: number;
  hpMax?: number;
}

export type SpecialAttackFleetRole = 'normal' | 'main' | 'escort' | 'other';

export interface DetectFleetSpecialAttackOptions {
  /**
   * Ship UIDs that have already triggered a flagship special attack in the
   * current sortie. Those attacks are once-per-sortie, so the badge should be
   * hidden after the corresponding ship has fired.
   */
  triggeredShipUids?: ReadonlyArray<number>;
  /** Trigger count by flagship UID for attacks that may fire multiple times. */
  triggeredShipCounts?: Map<number, number>;
  /** Current fleet role. Combined fleet specials are role-sensitive. */
  fleetRole?: SpecialAttackFleetRole;
  /** Current formation, if known. Numeric values use api_formation IDs. */
  formation?: Formation | number;
  /** Fleet type used by formation rules. */
  fleetType?: FleetType;
  /** api_combined_flag: 0=normal, 1=CTF, 2=STF, 3=TCF. */
  combinedType?: number;
  /** Whether this is a practice battle. */
  isPractice?: boolean;
  /** Whether the enemy is a combined fleet. Only checked when explicitly set. */
  enemyCombined?: boolean;
  /** Current battle is a night battle. Only checked when explicitly set. */
  isNightBattle?: boolean;
  /** Combined fleet route night node. */
  isCombinedRouteNightBattle?: boolean;
  /** PT-only or PT mixed special node. */
  isPtNode?: boolean;
  /** Two-way air battle night node. */
  isTwoWayAirBattleNight?: boolean;
  /** Friend fleets never trigger these panel badges. */
  isFriendFleet?: boolean;
  /** Required material for submarine fleet attack. */
  hasSubmarineSupplyMaterial?: boolean;
}

/**
 * Get attack positions for special attack type
 */
export function getAttackPositions(type: SpecialAttackType): number[] {
  switch (type) {
    case SpecialAttackType.NelsonTouch:
      return [1, 3, 5]; // 1番艦, 3番艦, 5番艦
    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
    case SpecialAttackType.RichelieuTouch:
    case SpecialAttackType.WarspiteTouch:
    case SpecialAttackType.YamatoTouch2:
      return [1, 2]; // 1番艦, 2番艦
    case SpecialAttackType.ColoradoTouch:
    case SpecialAttackType.YamatoTouch3:
      return [1, 2, 3]; // 1番艦, 2番艦, 3番艦
    case SpecialAttackType.KongouNightAttack:
      return [1, 2]; // Flagship + 2nd (special rules)
    case SpecialAttackType.SubmarineFleetAttack:
      return [1, 2, 3]; // AS flagship + submarines
    default:
      return [];
  }
}

// ==================== Required Formations ====================

/**
 * Check if formation allows special attack
 */
export function allowsSpecialAttack(
  type: SpecialAttackType,
  formation: Formation,
  fleetType: FleetType,
): boolean {
  switch (type) {
    case SpecialAttackType.NelsonTouch:
      // 複縦陣 or 第二警戒航行序列
      if (fleetType === FleetType.Normal) {
        return formation === Formation.DoubleLine;
      } else {
        return formation === Formation.CruisingFormation2;
      }

    case SpecialAttackType.ColoradoTouch:
    case SpecialAttackType.WarspiteTouch:
      // 梯形陣 or 第二警戒航行序列
      if (fleetType === FleetType.Normal) {
        return formation === Formation.Echelon;
      } else {
        return formation === Formation.CruisingFormation2;
      }

    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
      if (fleetType === FleetType.Normal) {
        return formation === Formation.Echelon;
      } else {
        return formation === Formation.CruisingFormation2;
      }

    case SpecialAttackType.RichelieuTouch:
      if (fleetType === FleetType.Normal) {
        return formation === Formation.DoubleLine;
      } else {
        return formation === Formation.CruisingFormation2;
      }

    case SpecialAttackType.YamatoTouch2:
    case SpecialAttackType.YamatoTouch3:
      if (fleetType === FleetType.Normal) {
        return formation === Formation.Echelon;
      }
      return formation === Formation.CruisingFormation4;

    case SpecialAttackType.KongouNightAttack:
      if (fleetType === FleetType.Normal) {
        return formation === Formation.LineAhead || formation === Formation.Echelon;
      }
      return formation === Formation.CruisingFormation4 || formation === Formation.CruisingFormation2;

    case SpecialAttackType.SubmarineFleetAttack:
      return fleetType === FleetType.Normal
        && (formation === Formation.Echelon || formation === Formation.LineAbreast);

    default:
      return false;
  }
}

// ==================== Flagship Ships ====================

/**
 * Ship master IDs that can activate special attacks as flagship
 */
export const SPECIAL_ATTACK_FLAGSHIP_IDS: Record<SpecialAttackType, Set<number>> = {
  [SpecialAttackType.NelsonTouch]: new Set([
    571, // Nelson
    576, // Nelson改
    572, // Rodney
    577, // Rodney改
  ]),
  [SpecialAttackType.NagatoTouch]: new Set([
    541, // 長門改二
  ]),
  [SpecialAttackType.MutsuTouch]: new Set([
    573, // 陸奥改二
  ]),
  [SpecialAttackType.ColoradoTouch]: new Set([
    601, // Colorado
    1496, // Colorado改
    913, // Maryland
    918, // Maryland改
  ]),
  [SpecialAttackType.RichelieuTouch]: new Set([
    392, // Richelieu改
    969, // Richelieu Deux
    724, // Jean Bart改
  ]),
  [SpecialAttackType.WarspiteTouch]: new Set([
    364, // Warspite改
    733, // Valiant改
  ]),
  [SpecialAttackType.YamatoTouch2]: new Set([
    911, // 大和改二
    916, // 大和改二重
    546, // 武蔵改二
  ]),
  [SpecialAttackType.YamatoTouch3]: new Set([
    911, // 大和改二
    916, // 大和改二重
    546, // 武蔵改二
  ]),
  [SpecialAttackType.KongouNightAttack]: new Set([
    591, // 金剛改二丙
    592, // 比叡改二丙
    593, // 榛名改二乙
    954, // 榛名改二丙
    694, // 霧島改二丙
  ]),
  [SpecialAttackType.SubmarineFleetAttack]: new Set([
    184, // 大鯨
    634, // 迅鯨
    635, // 長鯨
    639, // 迅鯨改
    640, // 長鯨改
    944, // 平安丸
    949, // 平安丸改
  ]),
};

const YAMATO_KAI2_IDS: Set<number> = new Set([911, 916]);
const MUSASHI_KAI2_IDS: Set<number> = new Set([546]);
const YAMATO_TWO_SHIP_PARTNER_IDS: Set<number> = new Set([
  546, // 武蔵改二
  360, // Iowa改
  392, // Richelieu改
  969, // Richelieu Deux
  178, // Bismarck drei
  724, // Jean Bart改
]);
const RICHELIEU_CLASS_TOUCH_IDS: Set<number> = new Set([392, 969, 724]);
const WARSPITE_CLASS_TOUCH_IDS: Set<number> = new Set([364, 733]);
const KONGOU_CLASS_KAI2_IDS: Set<number> = new Set([
  591, // 金剛改二丙
  592, // 比叡改二丙
  593, // 榛名改二乙
  954, // 榛名改二丙
  694, // 霧島改二丙
]);
const KONGOU_KAI2C_EXTRA_PARTNER_IDS: Set<number> = new Set([
  439, // Warspite
  364, // Warspite改
  927, // Valiant
  733, // Valiant改
  151, // 榛名改二
]);
const HIEI_KAI2C_EXTRA_PARTNER_IDS: Set<number> = new Set([
  152, // 霧島改二
]);
const KIRISHIMA_KAI2C_EXTRA_PARTNER_IDS: Set<number> = new Set([
  697, // South Dakota改
]);
const SUBMARINE_TENDER_MASTER_IDS: Set<number> = new Set([184, 634, 635, 639, 640, 944, 949]);
const KNOWN_BATTLESHIP_MASTER_IDS: Set<number> = new Set([
  151, 152, 178, 360, 364, 392, 439, 492, 541, 546, 571, 572, 573, 576,
  577, 591, 592, 593, 601, 602, 694, 697, 724, 733, 911, 913, 916, 918,
  927, 935, 954, 969, 1496,
]);

// ==================== Partner Ship Requirements ====================

interface PartnerSpec {
  /** 0-based fleet index of the required partner ship */
  fleetIndex: number;
  /** Allowed master IDs at this position; null = any ship is acceptable */
  validMasterIds: Set<number> | null;
}

/**
 * Required partner ships for each special attack type.
 * Keyed by fleet index (0-based).  Empty array = no partner restriction.
 */
export const SPECIAL_ATTACK_PARTNER_SPECS: Record<SpecialAttackType, PartnerSpec[]> = {
  [SpecialAttackType.NelsonTouch]: [
    { fleetIndex: 2, validMasterIds: null }, // position 3: any ship
    { fleetIndex: 4, validMasterIds: null }, // position 5: any ship
  ],
  [SpecialAttackType.NagatoTouch]: [
    { fleetIndex: 1, validMasterIds: null }, // battleship / aviation battleship
  ],
  [SpecialAttackType.MutsuTouch]: [
    { fleetIndex: 1, validMasterIds: null }, // battleship / aviation battleship
  ],
  [SpecialAttackType.ColoradoTouch]: [
    { fleetIndex: 1, validMasterIds: null }, // battleship / aviation battleship
    { fleetIndex: 2, validMasterIds: null }, // battleship / aviation battleship
  ],
  [SpecialAttackType.RichelieuTouch]: [
    { fleetIndex: 1, validMasterIds: RICHELIEU_CLASS_TOUCH_IDS },
  ],
  [SpecialAttackType.WarspiteTouch]: [
    { fleetIndex: 1, validMasterIds: WARSPITE_CLASS_TOUCH_IDS },
  ],
  [SpecialAttackType.YamatoTouch2]: [
    { fleetIndex: 1, validMasterIds: null },
  ],
  [SpecialAttackType.YamatoTouch3]: [
    { fleetIndex: 1, validMasterIds: null },
    { fleetIndex: 2, validMasterIds: null },
  ],
  [SpecialAttackType.KongouNightAttack]: [
    { fleetIndex: 1, validMasterIds: null },
  ],
  [SpecialAttackType.SubmarineFleetAttack]: [
    { fleetIndex: 1, validMasterIds: null },
    { fleetIndex: 2, validMasterIds: null },
  ],
};

export function specialAttackTypeFromApiCode(code: number): SpecialAttackType | null {
  switch (code) {
    case 100: return SpecialAttackType.NelsonTouch;
    case 101: return SpecialAttackType.NagatoTouch;
    case 102: return SpecialAttackType.MutsuTouch;
    case 103: return SpecialAttackType.ColoradoTouch;
    case 104: return SpecialAttackType.KongouNightAttack;
    case 105: return SpecialAttackType.RichelieuTouch;
    case 106: return SpecialAttackType.WarspiteTouch;
    case 300:
    case 301:
    case 302:
      return SpecialAttackType.SubmarineFleetAttack;
    case 400: return SpecialAttackType.YamatoTouch3;
    case 401: return SpecialAttackType.YamatoTouch2;
    default: return null;
  }
}

export function isSpecialAttackApiCode(code: number): boolean {
  return specialAttackTypeFromApiCode(code) !== null;
}

/** Ordered list used when iterating all types for detection. */
const ALL_SPECIAL_ATTACK_TYPES: SpecialAttackType[] = [
  SpecialAttackType.YamatoTouch3,
  SpecialAttackType.YamatoTouch2,
  SpecialAttackType.NagatoTouch,
  SpecialAttackType.MutsuTouch,
  SpecialAttackType.ColoradoTouch,
  SpecialAttackType.NelsonTouch,
  SpecialAttackType.RichelieuTouch,
  SpecialAttackType.WarspiteTouch,
  SpecialAttackType.KongouNightAttack,
  SpecialAttackType.SubmarineFleetAttack,
];

function getTriggeredCount(ship: SpecialAttackFleetShip, options?: DetectFleetSpecialAttackOptions): number {
  const uid = ship.uid ?? 0;
  if (uid <= 0) return 0;
  const count = options?.triggeredShipCounts?.get(uid);
  if (count !== undefined) return count;
  return (options?.triggeredShipUids ?? []).indexOf(uid) >= 0 ? 1 : 0;
}

function isSunk(ship: SpecialAttackFleetShip): boolean {
  if (ship.hpNow === undefined) return false;
  return ship.hpNow <= 0;
}

function isChuuhaOrWorse(ship: SpecialAttackFleetShip): boolean {
  if (ship.hpNow === undefined || ship.hpMax === undefined || ship.hpMax <= 0) return false;
  return ship.hpNow <= 0 || ship.hpNow / ship.hpMax <= 0.5;
}

function isTaihaOrWorse(ship: SpecialAttackFleetShip): boolean {
  if (ship.hpNow === undefined || ship.hpMax === undefined || ship.hpMax <= 0) return false;
  return ship.hpNow <= 0 || ship.hpNow / ship.hpMax <= 0.25;
}

function getShipType(ship: SpecialAttackFleetShip): ShipType | null {
  const stype = ship.stype ?? 0;
  return stype > 0 ? (stype as ShipType) : null;
}

function isShipCarrier(ship: SpecialAttackFleetShip): boolean {
  const stype = getShipType(ship);
  return stype !== null && isCarrierType(stype);
}

function isShipSubmarine(ship: SpecialAttackFleetShip): boolean {
  const stype = getShipType(ship);
  return stype !== null && isSubmarineType(stype);
}

function isShipSurface(ship: SpecialAttackFleetShip): boolean {
  const stype = getShipType(ship);
  return stype === null || !isSubmarineType(stype);
}

function isShipBattleship(ship: SpecialAttackFleetShip): boolean {
  const stype = getShipType(ship);
  if (stype !== null) return isBattleshipType(stype);
  return KNOWN_BATTLESHIP_MASTER_IDS.has(ship.masterId);
}

function isSubmarineTender(ship: SpecialAttackFleetShip): boolean {
  const stype = getShipType(ship);
  if (stype !== null) return stype === ShipType.AS;
  return SUBMARINE_TENDER_MASTER_IDS.has(ship.masterId);
}

function hasSixSurfaceShips(ships: ReadonlyArray<SpecialAttackFleetShip>): boolean {
  return ships.length === 6 && ships.every((ship: SpecialAttackFleetShip): boolean => isShipSurface(ship));
}

function hasKongouFleetShape(ships: ReadonlyArray<SpecialAttackFleetShip>): boolean {
  if (ships.length < 5 || ships.length > 6) return false;
  let surfaceCount = 0;
  let submarineCount = 0;
  for (const ship of ships) {
    if (isShipSubmarine(ship)) {
      submarineCount += 1;
    } else {
      surfaceCount += 1;
    }
  }
  return surfaceCount === 5 && submarineCount <= 1;
}

function canFlagshipTriggerSpecialAttack(type: SpecialAttackType, ship: SpecialAttackFleetShip): boolean {
  if (isSunk(ship)) return false;
  if (type === SpecialAttackType.KongouNightAttack ||
      type === SpecialAttackType.SubmarineFleetAttack) {
    return !isTaihaOrWorse(ship);
  }
  return !isChuuhaOrWorse(ship);
}

function canPartnerJoinSpecialAttack(type: SpecialAttackType, ship: SpecialAttackFleetShip): boolean {
  if (isSunk(ship)) return false;
  if (type === SpecialAttackType.YamatoTouch2 ||
      type === SpecialAttackType.YamatoTouch3) {
    return !isChuuhaOrWorse(ship);
  }
  if (type === SpecialAttackType.KongouNightAttack ||
      type === SpecialAttackType.NagatoTouch ||
      type === SpecialAttackType.MutsuTouch ||
      type === SpecialAttackType.ColoradoTouch ||
      type === SpecialAttackType.RichelieuTouch ||
      type === SpecialAttackType.WarspiteTouch ||
      type === SpecialAttackType.SubmarineFleetAttack) {
    return !isTaihaOrWorse(ship);
  }
  return true;
}

function formationFromOption(value?: Formation | number): Formation | null {
  if (value === undefined) return null;
  if (typeof value !== 'number') return value;
  switch (value) {
    case 1: return Formation.LineAhead;
    case 2: return Formation.DoubleLine;
    case 3: return Formation.Diamond;
    case 4: return Formation.Echelon;
    case 5: return Formation.LineAbreast;
    case 6: return Formation.Vanguard;
    case 11: return Formation.CruisingFormation1;
    case 12: return Formation.CruisingFormation2;
    case 13: return Formation.CruisingFormation3;
    case 14: return Formation.CruisingFormation4;
    default: return null;
  }
}

function fleetTypeFromOptions(options?: DetectFleetSpecialAttackOptions): FleetType {
  if (options?.fleetType !== undefined) return options.fleetType;
  switch (options?.combinedType ?? 0) {
    case 1: return FleetType.CombinedCarrier;
    case 2: return FleetType.CombinedSurface;
    case 3: return FleetType.CombinedTransport;
    default: return FleetType.Normal;
  }
}

function isFormationAllowed(type: SpecialAttackType, options?: DetectFleetSpecialAttackOptions): boolean {
  const formation = formationFromOption(options?.formation);
  if (formation === null) return true;
  return allowsSpecialAttack(type, formation, fleetTypeFromOptions(options));
}

function isFleetRoleAllowed(type: SpecialAttackType, options?: DetectFleetSpecialAttackOptions): boolean {
  const role = options?.fleetRole ?? 'normal';
  if (role === 'other') return false;
  if (type === SpecialAttackType.KongouNightAttack) {
    return role === 'normal' || role === 'escort';
  }
  if (type === SpecialAttackType.SubmarineFleetAttack) {
    return role === 'normal' && (options?.combinedType ?? 0) === 0;
  }
  return role === 'normal' || role === 'main';
}

function isDisallowedByBattleContext(type: SpecialAttackType, options?: DetectFleetSpecialAttackOptions): boolean {
  if (options?.isPractice === true || options?.isFriendFleet === true) return true;
  if (options?.isPtNode === true || options?.isTwoWayAirBattleNight === true) return true;
  if (type === SpecialAttackType.KongouNightAttack && options?.isNightBattle === false) return true;
  if (type === SpecialAttackType.NelsonTouch && options?.isCombinedRouteNightBattle === true) return true;
  const ctfAgainstSingleEnemy = (options?.combinedType ?? 0) === 1 && options?.enemyCombined === false;
  if (ctfAgainstSingleEnemy &&
      (type === SpecialAttackType.NagatoTouch ||
       type === SpecialAttackType.MutsuTouch ||
       type === SpecialAttackType.RichelieuTouch ||
       type === SpecialAttackType.WarspiteTouch)) {
    return true;
  }
  return false;
}

function hasReachedTriggerLimit(
  type: SpecialAttackType,
  flagship: SpecialAttackFleetShip,
  options?: DetectFleetSpecialAttackOptions,
): boolean {
  if (type === SpecialAttackType.SubmarineFleetAttack) return false;
  const count = getTriggeredCount(flagship, options);
  if (type === SpecialAttackType.KongouNightAttack) return count >= 3;
  return count > 0;
}

function isFlagshipCandidate(type: SpecialAttackType, flagship: SpecialAttackFleetShip): boolean {
  if (type === SpecialAttackType.SubmarineFleetAttack) return isSubmarineTender(flagship);
  return SPECIAL_ATTACK_FLAGSHIP_IDS[type].has(flagship.masterId);
}

function isYamatoSecondShipEligible(flagship: SpecialAttackFleetShip, partner: SpecialAttackFleetShip): boolean {
  if (YAMATO_KAI2_IDS.has(flagship.masterId)) return YAMATO_TWO_SHIP_PARTNER_IDS.has(partner.masterId);
  if (MUSASHI_KAI2_IDS.has(flagship.masterId)) return YAMATO_KAI2_IDS.has(partner.masterId);
  return false;
}

function isKongouPartnerEligible(flagship: SpecialAttackFleetShip, partner: SpecialAttackFleetShip): boolean {
  if (KONGOU_CLASS_KAI2_IDS.has(partner.masterId)) return true;
  if (flagship.masterId === 591) return KONGOU_KAI2C_EXTRA_PARTNER_IDS.has(partner.masterId);
  if (flagship.masterId === 592) return HIEI_KAI2C_EXTRA_PARTNER_IDS.has(partner.masterId);
  if (flagship.masterId === 694) return KIRISHIMA_KAI2C_EXTRA_PARTNER_IDS.has(partner.masterId);
  return false;
}

function hasSubmarineFleetAttackShape(
  ships: ReadonlyArray<SpecialAttackFleetShip>,
  options?: DetectFleetSpecialAttackOptions,
): boolean {
  if (options?.hasSubmarineSupplyMaterial !== true) return false;
  if (ships.length < 3) return false;
  const flagship = ships[0];
  const ship2 = ships[1];
  const ship3 = ships[2];
  if (!isSubmarineTender(flagship) || (flagship.level ?? 0) <= 30) return false;
  if (!isShipSubmarine(ship2) || !isShipSubmarine(ship3)) return false;
  const submarines = ships.filter((ship: SpecialAttackFleetShip): boolean => isShipSubmarine(ship));
  if (submarines.length === 2) {
    return submarines.every((ship: SpecialAttackFleetShip): boolean => !isChuuhaOrWorse(ship));
  }
  if (submarines.length >= 3) {
    let damagedCoreSubs = 0;
    const coreShips = ships.slice(1, 4);
    for (const ship of coreShips) {
      if (isShipSubmarine(ship) && isChuuhaOrWorse(ship)) damagedCoreSubs += 1;
    }
    return damagedCoreSubs < 2;
  }
  return false;
}

function isSpecialAttackCompositionEligible(
  type: SpecialAttackType,
  ships: ReadonlyArray<SpecialAttackFleetShip>,
  options?: DetectFleetSpecialAttackOptions,
): boolean {
  const flagship = ships[0];
  const ship2 = ships[1];
  const ship3 = ships[2];
  const ship5 = ships[4];

  switch (type) {
    case SpecialAttackType.NelsonTouch:
      return hasSixSurfaceShips(ships)
        && ship3 !== undefined
        && ship5 !== undefined
        && !isShipCarrier(ship3)
        && !isShipCarrier(ship5)
        && !isShipSubmarine(ship3)
        && !isShipSubmarine(ship5);

    case SpecialAttackType.YamatoTouch2:
      return hasSixSurfaceShips(ships)
        && ship2 !== undefined
        && isYamatoSecondShipEligible(flagship, ship2)
        && canPartnerJoinSpecialAttack(type, ship2);

    case SpecialAttackType.YamatoTouch3:
      return hasSixSurfaceShips(ships)
        && ship2 !== undefined
        && ship3 !== undefined
        && isYamatoSecondShipEligible(flagship, ship2)
        && isShipBattleship(ship3)
        && canPartnerJoinSpecialAttack(type, ship2)
        && canPartnerJoinSpecialAttack(type, ship3);

    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
      return hasSixSurfaceShips(ships)
        && ship2 !== undefined
        && isShipBattleship(ship2)
        && canPartnerJoinSpecialAttack(type, ship2);

    case SpecialAttackType.ColoradoTouch:
      return hasSixSurfaceShips(ships)
        && ship2 !== undefined
        && ship3 !== undefined
        && isShipBattleship(ship2)
        && isShipBattleship(ship3)
        && canPartnerJoinSpecialAttack(type, ship2)
        && canPartnerJoinSpecialAttack(type, ship3);

    case SpecialAttackType.RichelieuTouch:
      return hasSixSurfaceShips(ships)
        && ship2 !== undefined
        && RICHELIEU_CLASS_TOUCH_IDS.has(ship2.masterId)
        && canPartnerJoinSpecialAttack(type, ship2);

    case SpecialAttackType.WarspiteTouch:
      return hasSixSurfaceShips(ships)
        && ship2 !== undefined
        && WARSPITE_CLASS_TOUCH_IDS.has(ship2.masterId)
        && canPartnerJoinSpecialAttack(type, ship2);

    case SpecialAttackType.KongouNightAttack:
      return hasKongouFleetShape(ships)
        && ship2 !== undefined
        && isKongouPartnerEligible(flagship, ship2)
        && canPartnerJoinSpecialAttack(type, ship2);

    case SpecialAttackType.SubmarineFleetAttack:
      return hasSubmarineFleetAttackShape(ships, options);

    default:
      return false;
  }
}

/**
 * Detect whether a fleet composition and current ship state can still use a
 * special attack. Ships must be in fleet order (index 0 = flagship).
 * Returns the first matching SpecialAttackType, or null if none.
 */
export function detectFleetSpecialAttack(
  ships: ReadonlyArray<SpecialAttackFleetShip>,
  options?: DetectFleetSpecialAttackOptions,
): SpecialAttackType | null {
  if (ships.length === 0) return null;
  const flagship = ships[0];

  for (const type of ALL_SPECIAL_ATTACK_TYPES) {
    if (!isFlagshipCandidate(type, flagship)) continue;
    if (hasReachedTriggerLimit(type, flagship, options)) continue;
    if (!canFlagshipTriggerSpecialAttack(type, flagship)) continue;
    if (!isFleetRoleAllowed(type, options)) continue;
    if (isDisallowedByBattleContext(type, options)) continue;
    if (!isFormationAllowed(type, options)) continue;
    if (!isSpecialAttackCompositionEligible(type, ships, options)) continue;
    return type;
  }
  return null;
}

/** Short display label for use in compact UI badges. */
export function getSpecialAttackShortLabel(type: SpecialAttackType): string {
  switch (type) {
    case SpecialAttackType.NelsonTouch:      return 'NT';
    case SpecialAttackType.NagatoTouch:      return '長門斉射';
    case SpecialAttackType.MutsuTouch:       return '陸奥斉射';
    case SpecialAttackType.ColoradoTouch:    return '科摸';
    case SpecialAttackType.RichelieuTouch:   return '法国砲撃';
    case SpecialAttackType.WarspiteTouch:    return '红茶砲撃';
    case SpecialAttackType.YamatoTouch2:     return '大和摸(2)';
    case SpecialAttackType.YamatoTouch3:     return '大和摸(3)';
    case SpecialAttackType.KongouNightAttack: return '金剛突撃';
    case SpecialAttackType.SubmarineFleetAttack: return '潜水攻撃';
    default: return '';
  }
}

// ==================== Rate Calculation ====================

/**
 * Special attack calculation input
 */
export interface SpecialAttackInput {
  /** Special attack type */
  type: SpecialAttackType;
  /** Flagship level */
  flagshipLevel: number;
  /** Flagship luck */
  flagshipLuck: number;
  /** Flagship damage state */
  flagshipDamageState: DamageState;
  /** Partner ship(s) levels */
  partnerLevels: number[];
  /** Partner ship(s) luck values */
  partnerLucks: number[];
  /** Has AP shell equipped */
  hasAPShell: boolean;
  /** Has LoS 5+ radar equipped */
  hasLoSRadar: boolean;
  /** Has special main gun bonus */
  hasMainGunBonus: boolean;
}

/**
 * Special attack calculation result
 */
export interface SpecialAttackResult {
  /** Activation rate (%) */
  rate: number;
  /** Rate formula used */
  formula: string;
  /** Breakdown of components */
  breakdown: {
    flagshipComponent: number;
    partnerComponent: number;
    luckComponent: number;
    baseComponent: number;
    equipmentBonus: number;
  };
  /** Can activate (all conditions met) */
  canActivate: boolean;
  /** Reason if cannot activate */
  reason?: string;
}

// ==================== Nelson Touch Rate ====================

/**
 * Calculate Nelson Touch activation rate
 *
 * Formula: floor(1.1×√(1番艦Lv) + 1.4×√(1番艦運) + √(3番艦Lv) + √(5番艦Lv) + 25)
 */
export function calcNelsonTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Nelson Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  // Need 2 partner ships (positions 3 and 5)
  if (input.partnerLevels.length < 2) {
    return {
      rate: 0,
      formula: 'Nelson Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  const flagshipComponent = 1.1 * Math.sqrt(input.flagshipLevel);
  const luckComponent = 1.4 * Math.sqrt(input.flagshipLuck);
  const partner3Component = Math.sqrt(input.partnerLevels[0]);
  const partner5Component = Math.sqrt(input.partnerLevels[1]);
  const partnerComponent = partner3Component + partner5Component;
  const baseComponent = 25;

  const rawRate = Math.floor(flagshipComponent + luckComponent + partnerComponent + baseComponent);
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(1.1×√Lv1 + 1.4×√運1 + √Lv3 + √Lv5 + 25)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus: 0,
    },
    canActivate: true,
  };
}

// ==================== Nagato/Mutsu Touch Rate ====================

/**
 * Calculate Nagato/Mutsu Touch activation rate
 *
 * Formula: floor(√(1番艦Lv) + √(2番艦Lv) + 1.5×(√(1番艦運) + √(2番艦運)) + 25)
 * Or: (√一番艦Lv + √二番艦Lv) + 1.2×(√一艦運 + √二番艦運) + 30
 */
export function calcNagatoTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Nagato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  // Need 1 partner ship (position 2)
  if (input.partnerLevels.length < 1 || input.partnerLucks.length < 1) {
    return {
      rate: 0,
      formula: 'Nagato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  const flagshipComponent = Math.sqrt(input.flagshipLevel);
  const partnerComponent = Math.sqrt(input.partnerLevels[0]);
  const luckComponent = 1.5 * (Math.sqrt(input.flagshipLuck) + Math.sqrt(input.partnerLucks[0]));
  const baseComponent = 25;

  // Equipment bonuses (estimates)
  let equipmentBonus = 0;
  if (input.hasAPShell) equipmentBonus += 1.35;
  if (input.hasLoSRadar) equipmentBonus += 1.25;
  if (input.hasAPShell && input.hasLoSRadar) equipmentBonus += 0.95; // Combined bonus

  const rawRate = Math.floor(
    flagshipComponent + partnerComponent + luckComponent + baseComponent + equipmentBonus
  );
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(√Lv1 + √Lv2 + 1.5×(√運1 + √運2) + 25 + equip)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus,
    },
    canActivate: true,
  };
}

// ==================== Colorado Touch Rate ====================

/**
 * Calculate Colorado Touch activation rate
 *
 * Formula: Similar to Nelson, uses positions 1, 2, 3
 */
export function calcColoradoTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Colorado Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  // Need 2 partner ships (positions 2 and 3)
  if (input.partnerLevels.length < 2) {
    return {
      rate: 0,
      formula: 'Colorado Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  // Similar formula to Nelson
  const flagshipComponent = 1.1 * Math.sqrt(input.flagshipLevel);
  const luckComponent = 1.4 * Math.sqrt(input.flagshipLuck);
  const partner2Component = Math.sqrt(input.partnerLevels[0]);
  const partner3Component = Math.sqrt(input.partnerLevels[1]);
  const partnerComponent = partner2Component + partner3Component;
  const baseComponent = 25;

  const rawRate = Math.floor(flagshipComponent + luckComponent + partnerComponent + baseComponent);
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(1.1×√Lv1 + 1.4×√運1 + √Lv2 + √Lv3 + 25)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus: 0,
    },
    canActivate: true,
  };
}

// ==================== Yamato Touch Rate ====================

/**
 * Calculate Yamato Touch activation rate
 *
 * Uses similar formula to Nagato but for combined fleet
 */
export function calcYamatoTouchRate(input: SpecialAttackInput): SpecialAttackResult {
  // Check flagship damage
  if (input.flagshipDamageState === DamageState.Chuuha ||
    input.flagshipDamageState === DamageState.Taiha ||
    input.flagshipDamageState === DamageState.Sunk) {
    return {
      rate: 0,
      formula: 'Yamato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Flagship is damaged (中破以上)',
    };
  }

  const requiredPartners = input.type === SpecialAttackType.YamatoTouch3 ? 2 : 1;
  if (input.partnerLevels.length < requiredPartners) {
    return {
      rate: 0,
      formula: 'Yamato Touch',
      breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
      canActivate: false,
      reason: 'Not enough partner ships',
    };
  }

  const flagshipComponent = Math.sqrt(input.flagshipLevel);
  let partnerComponent = 0;
  let luckSum = Math.sqrt(input.flagshipLuck);

  for (let i = 0; i < requiredPartners; i++) {
    partnerComponent += Math.sqrt(input.partnerLevels[i] || 1);
    luckSum += Math.sqrt(input.partnerLucks[i] || 1);
  }

  const luckComponent = 1.5 * luckSum;
  const baseComponent = 25;

  const rawRate = Math.floor(flagshipComponent + partnerComponent + luckComponent + baseComponent);
  const rate = clampRate(rawRate, MAX_RATE);

  return {
    rate,
    formula: 'floor(√LvSum + 1.5×√運Sum + 25)',
    breakdown: {
      flagshipComponent,
      partnerComponent,
      luckComponent,
      baseComponent,
      equipmentBonus: 0,
    },
    canActivate: true,
  };
}

// ==================== Generic Calculator ====================

/**
 * Calculate special attack activation rate
 */
export function calcSpecialAttackRate(input: SpecialAttackInput): SpecialAttackResult {
  switch (input.type) {
    case SpecialAttackType.NelsonTouch:
      return calcNelsonTouchRate(input);

    case SpecialAttackType.NagatoTouch:
    case SpecialAttackType.MutsuTouch:
    case SpecialAttackType.RichelieuTouch:
    case SpecialAttackType.WarspiteTouch:
      return calcNagatoTouchRate(input);

    case SpecialAttackType.ColoradoTouch:
      return calcColoradoTouchRate(input);

    case SpecialAttackType.YamatoTouch2:
    case SpecialAttackType.YamatoTouch3:
      return calcYamatoTouchRate(input);

    case SpecialAttackType.KongouNightAttack:
      // Night attack uses different mechanics
      return calcNagatoTouchRate(input); // Simplified

    case SpecialAttackType.SubmarineFleetAttack:
      return calcNagatoTouchRate(input); // Placeholder for panel compatibility

    default:
      return {
        rate: 0,
        formula: 'Unknown',
        breakdown: { flagshipComponent: 0, partnerComponent: 0, luckComponent: 0, baseComponent: 0, equipmentBonus: 0 },
        canActivate: false,
        reason: 'Unknown special attack type',
      };
  }
}

// ==================== Quick Calculation ====================

/**
 * Quick calculation for common scenarios
 */
export function quickCalcSpecialAttackRate(
  type: SpecialAttackType,
  flagshipLevel: number,
  flagshipLuck: number,
  partnerLevels: number[],
  partnerLucks: number[] = [],
): number {
  const result = calcSpecialAttackRate({
    type,
    flagshipLevel,
    flagshipLuck,
    flagshipDamageState: DamageState.Normal,
    partnerLevels,
    partnerLucks: partnerLucks.length > 0 ? partnerLucks : partnerLevels.map(() => 20),
    hasAPShell: false,
    hasLoSRadar: false,
    hasMainGunBonus: false,
  });

  return result.rate;
}

// ==================== Display Helpers ====================

/**
 * Get special attack type display name
 */
export function getSpecialAttackTypeName(type: SpecialAttackType): string {
  switch (type) {
    case SpecialAttackType.NelsonTouch:
      return 'Nelson Touch';
    case SpecialAttackType.NagatoTouch:
      return '一斉射かッ…胸が熱いな！';
    case SpecialAttackType.MutsuTouch:
      return '長門、いい？いくわよ！主砲一斉射ッ！';
    case SpecialAttackType.ColoradoTouch:
      return 'Colorado Touch';
    case SpecialAttackType.RichelieuTouch:
      return 'Richelieuよ！圧倒しなさいっ！';
    case SpecialAttackType.WarspiteTouch:
      return '姉妹艦連携砲撃';
    case SpecialAttackType.YamatoTouch2:
      return '大和、突撃します！';
    case SpecialAttackType.YamatoTouch3:
      return '第一戦隊、突撃！主砲、全力斉射ッ！';
    case SpecialAttackType.KongouNightAttack:
      return '僚艦夜戦突撃';
    case SpecialAttackType.SubmarineFleetAttack:
      return '潜水艦隊攻撃';
    default:
      return 'Unknown';
  }
}

/**
 * Format special attack result for display
 */
export function formatSpecialAttackResult(result: SpecialAttackResult): string {
  const lines: string[] = [];

  if (!result.canActivate) {
    lines.push(`Cannot Activate: ${result.reason}`);
    return lines.join('\n');
  }

  lines.push(`Activation Rate: ${result.rate.toFixed(1)}%`);
  lines.push(`Formula: ${result.formula}`);
  lines.push('Components:');
  lines.push(`  Flagship: ${result.breakdown.flagshipComponent.toFixed(2)}`);
  lines.push(`  Partner: ${result.breakdown.partnerComponent.toFixed(2)}`);
  lines.push(`  Luck: ${result.breakdown.luckComponent.toFixed(2)}`);
  lines.push(`  Base: ${result.breakdown.baseComponent}`);

  if (result.breakdown.equipmentBonus > 0) {
    lines.push(`  Equipment: +${result.breakdown.equipmentBonus.toFixed(2)}`);
  }

  return lines.join('\n');
}

// ==================== Example Rate Table ====================

/**
 * Generate example rates for common scenarios
 */
export function generateExampleRates(type: SpecialAttackType): Array<{
  scenario: string;
  rate: number;
}> {
  const examples: Array<{ scenario: string; rate: number }> = [];

  switch (type) {
    case SpecialAttackType.NelsonTouch:
      examples.push({
        scenario: 'Lv99 Nelson (運28) + Lv99 partners',
        rate: quickCalcSpecialAttackRate(type, 99, 28, [99, 99]),
      });
      examples.push({
        scenario: 'Lv180 Nelson (運98) + Lv180 partners',
        rate: quickCalcSpecialAttackRate(type, 180, 98, [180, 180]),
      });
      break;

    case SpecialAttackType.NagatoTouch:
      examples.push({
        scenario: 'Lv99 長門 (運40) + Lv99 陸奥 (運16)',
        rate: quickCalcSpecialAttackRate(type, 99, 40, [99], [16]),
      });
      examples.push({
        scenario: 'Lv130 長門 (運43) + Lv99 陸奥 (運16)',
        rate: quickCalcSpecialAttackRate(type, 130, 43, [99], [16]),
      });
      break;

    default:
      examples.push({
        scenario: 'Lv99 all ships',
        rate: quickCalcSpecialAttackRate(type, 99, 30, [99, 99]),
      });
  }

  return examples;
}
