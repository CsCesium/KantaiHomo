/**
 * Ship Battle Scenario Builder
 *
 * Detects the attack types a ship can perform in each battle phase
 * (昼砲撃 / 雷撃 / 夜戦) from its equipment, then estimates per-type
 * trigger rates and post-cap attack power (平击) / critical power (爆击).
 *
 * Trigger rates of mutually exclusive attacks are chained by priority:
 * P(type_i) = (1 - ΣP(higher priority)) × singleRollRate_i, with the
 * remainder assigned to the normal attack.
 */

import {
  DayAttackType,
  ScenarioAttack,
  ScenarioEquip,
  ShipBattleScenarios,
  ShipScenarioInput,
} from './damage_types';
import {
  ANTI_SUBMARINE_CAP,
  DAY_BATTLE_CAP,
  NIGHT_BATTLE_CAP,
  TORPEDO_BATTLE_CAP,
  antiSubmarineBasePower,
  carrierNightBasePower,
  criticalPower,
  dayCarrierBasePower,
  daySurfaceBasePower,
  finalAttackPower,
  finalPreCapModifierAttackPower,
  nightBasePower,
  torpedoBasePower,
} from './attack_power';
import { calcDayAttackRate, calcObservationTerm } from './day_attack_rate';
import {
  antiSubmarineImprovementBonus,
  carrierDayImprovementBonus,
  dayImprovementBonus,
  nightImprovementBonus,
  torpedoImprovementBonus,
} from './improvement_bonus';
import {
  NightCutInType,
  calcNightCutInRate,
} from '../rate/night_cutin_rate';
import { ShipPosition, getDamageState } from '../rate/rate_types';
import {
  ShipType,
  SlotItemEquipType,
  SlotItemIconId,
  isBattleshipType,
  isCarrierType,
  isSubmarineType,
} from '../../../domain/models';

// ==================== Equipment Classification ====================

interface EquipCounts {
  mainGun: number;
  secondaryGun: number;
  torpedo: number;
  radar: number;
  surfaceRadar: number;
  apShell: number;
  lookout: number;
  /** Embarked (onslot > 0) 水偵/水爆 */
  spottingPlane: number;
  /** Embarked 艦戦 */
  carrierFighter: number;
  /** Embarked 艦爆 */
  carrierDiveBomber: number;
  /** Embarked 艦攻 */
  carrierTorpedoBomber: number;
  /** Embarked 噴式戦闘機 */
  jetFighter: number;
  /** Embarked 噴式戦闘爆撃機 */
  jetFighterBomber: number;
  /** Embarked proper night fighters/attackers/dive bombers (enables night air attack) */
  nightPlane: number;
  /** Embarked proper night fighters */
  nightFighter: number;
  /** Embarked proper night torpedo bombers */
  nightAttacker: number;
  /** Embarked proper night dive bombers */
  nightDiveBomber: number;
  /** All embarked aircraft that participate in carrier night attack power */
  carrierNightPlane: number;
  /** Embarked Suisei Model 12 with Type 31 photoelectric-fuze bombs */
  photoNightBomber: number;
  /** Embarked 試製 夜間瑞雲 (攻撃装備) */
  nightZuiun: number;
  /** Σ equipment 対潜, including equipment that only affects displayed ASW */
  aswEquipTotal: number;
  /** Σ equipment 対潜 that contributes to anti-submarine attack power */
  aswPowerEquipTotal: number;
  /** Embarked aircraft that enables ASW targeting for conditional ship types */
  aswConditionAircraft: number;
  /** Embarked ASW aircraft that make the attack use the aircraft constant */
  aswAircraft: number;
  sonar: number;
  smallSonar: number;
  largeSonar: number;
  depthCharge: number;
  depthChargeProjector: number;
  mortar: number;
  depthChargeAny: number;
  /** Σ equipment 爆装 */
  bombTotal: number;
}

const NIGHT_ZUIUN_MASTER_ID = 490;
const PHOTOELECTRIC_SUISEI_MASTER_ID = 320;
const NIGHT_DIVE_BOMBER_MASTER_IDS: ReadonlySet<number> = new Set([552, 557, 558]);
const REDUCED_MODIFIER_NIGHT_PLANE_MASTER_IDS: ReadonlySet<number> = new Set([
  154, // 零戦62型(爆戦/岩井隊)
  242, // Swordfish
  243, // Swordfish Mk.II(熟練)
  244, // Swordfish Mk.III(熟練)
  PHOTOELECTRIC_SUISEI_MASTER_ID,
]);
const NARROW_DEPTH_CHARGE_MASTER_IDS: ReadonlySet<number> = new Set([226, 227, 378, 439, 488]);
const DEPTH_CHARGE_PROJECTOR_MASTER_IDS: ReadonlySet<number> = new Set([44, 45, 287, 288, 377, 472, 569]);
const UNCONDITIONAL_NIGHT_CARRIER_IDS: ReadonlySet<number> = new Set([
  529, // 大鷹改二
  536, // 神鷹改二
  646, // 加賀改二護
  889, // 雲鷹改二
]);
const UNCONDITIONAL_NIGHT_CARRIER_NAMES: ReadonlySet<string> = new Set([
  'Graf Zeppelin',
  'Graf Zeppelin改',
  'Saratoga',
  '大鷹改二',
  '大鹰改二',
  '神鷹改二',
  '神鹰改二',
  '雲鷹改二',
  '云鹰改二',
  '加賀改二護',
  '加贺改二护',
  'Lexington',
  'Lexington改',
  'Wasp',
  'Wasp改',
]);

function isMainGun(t: number): boolean {
  return t === SlotItemEquipType.SmallCaliberMainGun
    || t === SlotItemEquipType.MediumCaliberMainGun
    || t === SlotItemEquipType.LargeCaliberMainGun
    || t === SlotItemEquipType.LargeCaliberMainGunII;
}

function isTorpedoEquip(t: number): boolean {
  return t === SlotItemEquipType.Torpedo || t === SlotItemEquipType.SubmarineTorpedo;
}

function isRadar(t: number): boolean {
  return t === SlotItemEquipType.SmallRadar
    || t === SlotItemEquipType.LargeRadar
    || t === SlotItemEquipType.LargeRadarII;
}

function nameContainsAny(name: string, fragments: ReadonlyArray<string>): boolean {
  for (const fragment of fragments) {
    if (name.indexOf(fragment) >= 0) return true;
  }
  return false;
}

function isNightZuiunEquip(equip: ScenarioEquip): boolean {
  return equip.masterId === NIGHT_ZUIUN_MASTER_ID
    || equip.name.indexOf('夜間瑞雲') >= 0
    || equip.name.indexOf('夜间瑞云') >= 0;
}

function isFullModifierNightPlane(equip: ScenarioEquip): boolean {
  return equip.iconType === SlotItemIconId.NightFighter
    || equip.iconType === SlotItemIconId.NightAttacker
    || NIGHT_DIVE_BOMBER_MASTER_IDS.has(equip.masterId);
}

function isCarrierNightPowerPlane(equip: ScenarioEquip): boolean {
  return equip.onslot > 0
    && (isFullModifierNightPlane(equip)
      || REDUCED_MODIFIER_NIGHT_PLANE_MASTER_IDS.has(equip.masterId));
}

function isSonar(t: number): boolean {
  return t === SlotItemEquipType.Sonar || t === SlotItemEquipType.LargeSonar;
}

function isDepthChargeAny(t: number): boolean {
  return t === SlotItemEquipType.DepthCharge;
}

function isMortar(equip: ScenarioEquip): boolean {
  return isDepthChargeAny(equip.equipType) && nameContainsAny(equip.name, ['迫撃砲', '迫击炮']);
}

function isDepthChargeProjector(equip: ScenarioEquip): boolean {
  if (!isDepthChargeAny(equip.equipType)) return false;
  return DEPTH_CHARGE_PROJECTOR_MASTER_IDS.has(equip.masterId)
    || nameContainsAny(equip.name, ['投射機', '投射机', '噴進砲', '喷进炮', 'Weapon Alpha', 'Mk.32']);
}

function isNarrowDepthCharge(equip: ScenarioEquip): boolean {
  if (!isDepthChargeAny(equip.equipType)) return false;
  if (NARROW_DEPTH_CHARGE_MASTER_IDS.has(equip.masterId)) return true;
  if (isMortar(equip) || isDepthChargeProjector(equip)) return false;
  return nameContainsAny(equip.name, ['爆雷', 'Hedgehog', '短魚雷', '短鱼雷']);
}

function isAswAircraft(equip: ScenarioEquip): boolean {
  const t = equip.equipType;
  return equip.onslot > 0
    && equip.asw > 0
    && (t === SlotItemEquipType.CarrierTorpedoBomber
      || t === SlotItemEquipType.CarrierDiveBomber
      || t === SlotItemEquipType.JetFighterBomber
      || t === SlotItemEquipType.SeaplaneBomber
      || t === SlotItemEquipType.Autogyro
      || t === SlotItemEquipType.AntiSubPatrol);
}

function isAswConditionAircraft(equip: ScenarioEquip): boolean {
  if (equip.onslot <= 0) return false;
  const t = equip.equipType;
  if (t === SlotItemEquipType.LargeFlyingBoat) return true;
  if (t === SlotItemEquipType.SeaplaneBomber
      || t === SlotItemEquipType.Autogyro
      || t === SlotItemEquipType.AntiSubPatrol) {
    return true;
  }
  return equip.asw > 0
    && (t === SlotItemEquipType.CarrierTorpedoBomber
      || t === SlotItemEquipType.CarrierDiveBomber
      || t === SlotItemEquipType.JetFighterBomber);
}

function contributesToAswPower(equip: ScenarioEquip): boolean {
  if (equip.asw <= 0) return false;
  const t = equip.equipType;
  return isSonar(t) || isDepthChargeAny(t) || isAswAircraft(equip);
}

function hasCarrierDayAttackAircraft(counts: EquipCounts): boolean {
  return counts.carrierTorpedoBomber > 0
    || counts.carrierDiveBomber > 0
    || counts.jetFighterBomber > 0;
}

function isUnconditionalNightCarrier(input: ShipScenarioInput): boolean {
  return UNCONDITIONAL_NIGHT_CARRIER_IDS.has(input.shipMasterId)
    || UNCONDITIONAL_NIGHT_CARRIER_NAMES.has(input.shipName);
}

function countEquips(equips: ReadonlyArray<ScenarioEquip>): EquipCounts {
  const counts: EquipCounts = {
    mainGun: 0, secondaryGun: 0, torpedo: 0, radar: 0, surfaceRadar: 0,
    apShell: 0, lookout: 0, spottingPlane: 0, carrierFighter: 0,
    carrierDiveBomber: 0, carrierTorpedoBomber: 0, jetFighter: 0, jetFighterBomber: 0,
    nightPlane: 0, nightFighter: 0, nightAttacker: 0, nightDiveBomber: 0,
    carrierNightPlane: 0, photoNightBomber: 0, nightZuiun: 0,
    aswEquipTotal: 0, aswPowerEquipTotal: 0, aswConditionAircraft: 0, aswAircraft: 0,
    sonar: 0, smallSonar: 0, largeSonar: 0, depthCharge: 0, depthChargeProjector: 0, mortar: 0,
    depthChargeAny: 0, bombTotal: 0,
  };

  for (const eq of equips) {
    const t = eq.equipType;
    if (isMainGun(t)) counts.mainGun += 1;
    if (t === SlotItemEquipType.SecondaryGun) counts.secondaryGun += 1;
    if (isTorpedoEquip(t)) counts.torpedo += 1;
    if (isRadar(t)) {
      counts.radar += 1;
      // 水上電探: radar with LoS ≥ 5 (主魚電CI requirement)
      if (eq.los >= 5) counts.surfaceRadar += 1;
    }
    if (t === SlotItemEquipType.APShell) counts.apShell += 1;
    if (t === SlotItemEquipType.SurfaceShipPersonnel) counts.lookout += 1;
    if (isSonar(t)) {
      counts.sonar += 1;
      if (t === SlotItemEquipType.Sonar) counts.smallSonar += 1;
      if (t === SlotItemEquipType.LargeSonar) counts.largeSonar += 1;
    }
    if (isDepthChargeAny(t)) {
      counts.depthChargeAny += 1;
      if (isNarrowDepthCharge(eq)) counts.depthCharge += 1;
      if (isDepthChargeProjector(eq)) counts.depthChargeProjector += 1;
      if (isMortar(eq)) counts.mortar += 1;
    }
    counts.aswEquipTotal += eq.asw;
    if (contributesToAswPower(eq)) {
      counts.aswPowerEquipTotal += eq.asw;
    }

    const embarked = eq.onslot > 0;
    if (embarked && (t === SlotItemEquipType.SeaplaneRecon || t === SlotItemEquipType.SeaplaneBomber)) {
      counts.spottingPlane += 1;
    }
    if (embarked && t === SlotItemEquipType.CarrierFighter) {
      counts.carrierFighter += 1;
    }
    if (embarked && t === SlotItemEquipType.CarrierDiveBomber) {
      counts.carrierDiveBomber += 1;
    }
    if (embarked && t === SlotItemEquipType.CarrierTorpedoBomber) {
      counts.carrierTorpedoBomber += 1;
    }
    if (embarked && t === SlotItemEquipType.JetFighter) {
      counts.jetFighter += 1;
    }
    if (embarked && t === SlotItemEquipType.JetFighterBomber) {
      counts.jetFighterBomber += 1;
    }
    if (embarked && isFullModifierNightPlane(eq)) {
      counts.nightPlane += 1;
    }
    if (embarked && eq.iconType === SlotItemIconId.NightFighter) counts.nightFighter += 1;
    if (embarked && eq.iconType === SlotItemIconId.NightAttacker) counts.nightAttacker += 1;
    if (embarked && NIGHT_DIVE_BOMBER_MASTER_IDS.has(eq.masterId)) counts.nightDiveBomber += 1;
    if (isCarrierNightPowerPlane(eq)) counts.carrierNightPlane += 1;
    if (embarked && eq.masterId === PHOTOELECTRIC_SUISEI_MASTER_ID) counts.photoNightBomber += 1;
    if (embarked && isNightZuiunEquip(eq)) {
      counts.nightZuiun += 1;
    }
    if (isAswConditionAircraft(eq)) {
      counts.aswConditionAircraft += 1;
    }
    if (isAswAircraft(eq)) {
      counts.aswAircraft += 1;
    }
    counts.bombTotal += eq.bomb;
  }

  return counts;
}

// ==================== Attack Type Metadata ====================

const DAY_ATTACK_LABEL = new Map<DayAttackType, string>([
  [DayAttackType.Normal, '普通攻击'],
  [DayAttackType.DoubleAttack, '连击'],
  [DayAttackType.MainMainCI, '主主CI'],
  [DayAttackType.MainApCI, '主彻CI'],
  [DayAttackType.MainRadarCI, '主电CI'],
  [DayAttackType.MainSecCI, '主副CI'],
  [DayAttackType.CarrierFBA, '战爆攻CI'],
  [DayAttackType.CarrierBBA, '爆爆攻CI'],
  [DayAttackType.CarrierBA, '爆攻CI'],
  [DayAttackType.CarrierJetFBB, '喷战爆²CI'],
  [DayAttackType.CarrierJetFB, '喷战爆CI'],
  [DayAttackType.CarrierJetFBA, '喷战爆攻CI'],
]);

/** Post-cap power modifier and hit count per day attack type. */
const DAY_ATTACK_POWER = new Map<DayAttackType, { modifier: number; hits: number }>([
  [DayAttackType.Normal, { modifier: 1.0, hits: 1 }],
  [DayAttackType.DoubleAttack, { modifier: 1.2, hits: 2 }],
  [DayAttackType.MainMainCI, { modifier: 1.5, hits: 1 }],
  [DayAttackType.MainApCI, { modifier: 1.3, hits: 1 }],
  [DayAttackType.MainRadarCI, { modifier: 1.2, hits: 1 }],
  [DayAttackType.MainSecCI, { modifier: 1.1, hits: 1 }],
  [DayAttackType.CarrierFBA, { modifier: 1.25, hits: 1 }],
  [DayAttackType.CarrierBBA, { modifier: 1.2, hits: 1 }],
  [DayAttackType.CarrierBA, { modifier: 1.15, hits: 1 }],
  [DayAttackType.CarrierJetFBB, { modifier: 1.35, hits: 1 }],
  [DayAttackType.CarrierJetFB, { modifier: 1.3, hits: 1 }],
  [DayAttackType.CarrierJetFBA, { modifier: 1.27, hits: 1 }],
]);

const NIGHT_ATTACK_LABEL = new Map<NightCutInType, string>([
  [NightCutInType.DoubleAttack, '连击'],
  [NightCutInType.MainTorpRadarCI, '主鱼电CI'],
  [NightCutInType.TorpTorpLookoutCI, '鱼鱼水CI'],
  [NightCutInType.TorpedoCI, '鱼雷CI'],
  [NightCutInType.MainGunCI, '主主主CI'],
  [NightCutInType.MainSecondaryCI, '主主副CI'],
  [NightCutInType.MainTorpCI, '炮雷CI'],
  [NightCutInType.CarrierNightCI, '夜袭CI'],
  [NightCutInType.NightZuiunCI, '夜瑞CI'],
]);

/** Pre-cap power modifier and hit count per night attack type. */
const NIGHT_ATTACK_POWER = new Map<NightCutInType, { modifier: number; hits: number }>([
  [NightCutInType.DoubleAttack, { modifier: 1.2, hits: 2 }],
  [NightCutInType.MainTorpRadarCI, { modifier: 1.3, hits: 2 }],
  [NightCutInType.TorpTorpLookoutCI, { modifier: 1.5, hits: 2 }],
  [NightCutInType.TorpedoCI, { modifier: 1.5, hits: 2 }],
  [NightCutInType.MainGunCI, { modifier: 2.0, hits: 1 }],
  [NightCutInType.MainSecondaryCI, { modifier: 1.75, hits: 1 }],
  [NightCutInType.MainTorpCI, { modifier: 1.3, hits: 2 }],
]);

function canUseNightZuiunAttack(shipType: ShipType): boolean {
  return shipType === ShipType.CL
    || shipType === ShipType.CAV
    || shipType === ShipType.BBV
    || shipType === ShipType.AV;
}

function nightZuiunModifier(counts: EquipCounts): number {
  return (120
    + Math.min(2, counts.nightZuiun) * 4
    + (counts.surfaceRadar > 0 ? 4 : 0)) / 100;
}

/** Highest-priority carrier night cut-in modifier enabled by the loadout. */
function carrierNightCiModifier(counts: EquipCounts): number {
  if (counts.nightFighter >= 2 && counts.nightAttacker >= 1) return 1.25;
  if (counts.nightFighter >= 1 && counts.nightAttacker >= 1) return 1.2;

  const properPlaneWithoutPhoto = counts.nightFighter + counts.nightAttacker + counts.nightDiveBomber;
  if (counts.photoNightBomber >= 1 && properPlaneWithoutPhoto >= 1) return 1.2;
  if (counts.nightDiveBomber >= 1 && counts.nightFighter + counts.nightAttacker >= 1) return 1.2;

  if (counts.nightFighter >= 1 && counts.carrierNightPlane >= 3) return 1.18;
  return 1.0;
}

function nightAttackPower(type: NightCutInType, counts: EquipCounts): { modifier: number; hits: number } {
  if (type === NightCutInType.NightZuiunCI) {
    return { modifier: nightZuiunModifier(counts), hits: 2 };
  }
  if (type === NightCutInType.CarrierNightCI) {
    return { modifier: carrierNightCiModifier(counts), hits: 1 };
  }
  return NIGHT_ATTACK_POWER.get(type)!;
}

function antiSubmarineSynergyModifier(counts: EquipCounts): number {
  const oldSynergy = counts.sonar > 0 && (counts.depthChargeProjector > 0 || counts.mortar > 0) ? 1.15 : 1.0;
  const newSynergy = 1
    + (counts.smallSonar > 0 && counts.depthCharge > 0 ? 0.15 : 0)
    + (counts.depthChargeProjector > 0 && counts.depthCharge > 0 ? 0.1 : 0);
  const largeSonarDepthSynergy = counts.largeSonar > 0
    && counts.smallSonar <= 0
    && counts.depthCharge > 0
    && counts.depthChargeProjector <= 0
    && counts.mortar <= 0
    ? 1.15
    : 1.0;
  return oldSynergy * newSynergy * largeSonarDepthSynergy;
}

function isAswCoreShipType(shipType: ShipType): boolean {
  return shipType === ShipType.DE
    || shipType === ShipType.DD
    || shipType === ShipType.CL
    || shipType === ShipType.CLT
    || shipType === ShipType.CT
    || shipType === ShipType.AO;
}

function canUseAntiSubmarineAttack(shipType: ShipType, counts: EquipCounts): boolean {
  if (isSubmarineType(shipType) || shipType === ShipType.AS || shipType === ShipType.AR) return false;
  if (isAswCoreShipType(shipType)) return true;
  if (shipType === ShipType.CVL) return counts.aswConditionAircraft > 0;
  if (shipType === ShipType.AV || shipType === ShipType.LHA || shipType === ShipType.CAV || shipType === ShipType.BBV) {
    return counts.aswConditionAircraft > 0 || counts.depthChargeAny > 0;
  }
  return false;
}

// ==================== Attack Type Detection ====================

/**
 * Day cut-ins available to a surface ship, ordered by selection priority
 * (higher modifier rolls first).
 */
function detectDaySpottingAttacks(counts: EquipCounts): DayAttackType[] {
  if (counts.spottingPlane <= 0) return [];

  const types: DayAttackType[] = [];
  if (counts.mainGun >= 2 && counts.apShell >= 1) types.push(DayAttackType.MainMainCI);
  if (counts.mainGun >= 1 && counts.secondaryGun >= 1 && counts.apShell >= 1) types.push(DayAttackType.MainApCI);
  if (counts.mainGun >= 1 && counts.secondaryGun >= 1 && counts.radar >= 1) types.push(DayAttackType.MainRadarCI);
  if (counts.mainGun >= 1 && counts.secondaryGun >= 1) types.push(DayAttackType.MainSecCI);
  if (counts.mainGun >= 2) types.push(DayAttackType.DoubleAttack);
  return types;
}

/** Carrier cut-ins (戦爆連合), ordered by selection priority. */
function detectCarrierDayAttacks(counts: EquipCounts): DayAttackType[] {
  if (counts.carrierDiveBomber <= 0 || counts.carrierTorpedoBomber <= 0) return [];

  const types: DayAttackType[] = [];
  const hasOrdinaryBA = counts.carrierDiveBomber >= 1 && counts.carrierTorpedoBomber >= 1;
  const hasJetOnlyBombers = counts.carrierDiveBomber === 0 && counts.carrierTorpedoBomber === 0;
  const hasJetFighter = counts.jetFighter >= 1;

  if (counts.carrierFighter >= 1 && hasOrdinaryBA) {
    types.push(DayAttackType.CarrierFBA);
  }
  if (counts.carrierDiveBomber >= 2 && counts.carrierTorpedoBomber >= 1) {
    types.push(DayAttackType.CarrierBBA);
  }
  if (hasOrdinaryBA) {
    types.push(DayAttackType.CarrierBA);
  }
  if (hasJetFighter && counts.jetFighterBomber >= 2 && hasJetOnlyBombers) {
    types.push(DayAttackType.CarrierJetFBB);
  }
  if (hasJetFighter && counts.jetFighterBomber >= 1 && hasJetOnlyBombers) {
    types.push(DayAttackType.CarrierJetFB);
  }
  if (hasJetFighter && counts.jetFighterBomber === 0 && hasOrdinaryBA) {
    types.push(DayAttackType.CarrierJetFBA);
  }
  return types;
}

/**
 * Night attacks available to the ship, ordered by selection priority
 * (DD-exclusive and Night Zuiun cut-ins roll before generic cut-ins, then 連撃).
 */
function detectNightAttacks(input: ShipScenarioInput, counts: EquipCounts): NightCutInType[] {
  const shipType = input.stype as ShipType;
  const types: NightCutInType[] = [];

  if (isCarrierType(shipType)) {
    if (counts.nightPlane > 0) {
      if (carrierNightCiModifier(counts) > 1.0) types.push(NightCutInType.CarrierNightCI);
      return types;
    }
    if (!isUnconditionalNightCarrier(input)) return types;
  }

  if (shipType === ShipType.DD) {
    if (counts.mainGun >= 1 && counts.torpedo >= 1 && counts.surfaceRadar >= 1) {
      types.push(NightCutInType.MainTorpRadarCI);
    }
    if (counts.torpedo >= 2 && counts.lookout >= 1) {
      types.push(NightCutInType.TorpTorpLookoutCI);
    }
  }

  if (canUseNightZuiunAttack(shipType) && counts.mainGun >= 2 && counts.nightZuiun >= 1) {
    types.push(NightCutInType.NightZuiunCI);
  }

  if (counts.torpedo >= 2) {
    types.push(NightCutInType.TorpedoCI);
  } else if (counts.mainGun >= 3) {
    types.push(NightCutInType.MainGunCI);
  } else if (counts.mainGun >= 2 && counts.secondaryGun >= 1) {
    types.push(NightCutInType.MainSecondaryCI);
  } else if (counts.mainGun >= 1 && counts.torpedo >= 1) {
    types.push(NightCutInType.MainTorpCI);
  } else if (counts.mainGun >= 2) {
    types.push(NightCutInType.DoubleAttack);
  }

  return types;
}

// ==================== Scenario Assembly ====================

function makeAttack(
  id: string,
  label: string,
  hits: number,
  rate: number,
  basePower: number,
  cap: number,
  modifier: number,
): ScenarioAttack {
  const normal = finalAttackPower(basePower, cap, modifier);
  return { id, label, hits, rate, normal, critical: criticalPower(normal), modifier };
}

function makeNightAttack(
  id: string,
  label: string,
  hits: number,
  rate: number,
  basePower: number,
  modifier: number,
): ScenarioAttack {
  const normal = finalPreCapModifierAttackPower(basePower, NIGHT_BATTLE_CAP, modifier);
  return { id, label, hits, rate, normal, critical: criticalPower(normal), modifier };
}

function carrierIntrinsicFirepower(input: ShipScenarioInput): number {
  let equipmentFirepower = 0;
  for (const equip of input.equips) equipmentFirepower += equip.firepower;
  return Math.max(0, input.firepower - equipmentFirepower);
}

function buildCarrierNightBasePower(input: ShipScenarioInput): number {
  return carrierNightBasePower(
    carrierIntrinsicFirepower(input),
    input.equips
      .filter(isCarrierNightPowerPlane)
      .map(equip => ({
        firepower: equip.firepower,
        torpedo: equip.torpedo,
        bomb: equip.bomb,
        asw: equip.asw,
        level: equip.level,
        onslot: equip.onslot,
        fullNightModifier: isFullModifierNightPlane(equip),
      })),
  );
}

function buildDayScenarios(input: ShipScenarioInput, counts: EquipCounts): ScenarioAttack[] {
  const shipType = input.stype as ShipType;
  if (isSubmarineType(shipType)) return [];

  const carrier = isCarrierType(shipType);
  if (carrier && !hasCarrierDayAttackAircraft(counts)) return [];

  const basePower = carrier
    ? dayCarrierBasePower(input.firepower, input.torpedo, counts.bombTotal, carrierDayImprovementBonus(input.equips))
    : daySurfaceBasePower(input.firepower, dayImprovementBonus(input.equips));

  const ciTypes = carrier ? detectCarrierDayAttacks(counts) : detectDaySpottingAttacks(counts);

  const observationTerm = calcObservationTerm({
    luck: input.luck,
    fleetLoSTerm: input.fleetLoSTerm,
    isFlagship: input.isFlagship,
    airState: input.airState,
  });

  const attacks: ScenarioAttack[] = [];
  let remaining = 1;
  for (const type of ciTypes) {
    const power = DAY_ATTACK_POWER.get(type)!;
    const rate = remaining * calcDayAttackRate(type, observationTerm);
    attacks.push(makeAttack(
      type, DAY_ATTACK_LABEL.get(type) ?? type, power.hits, rate,
      basePower, DAY_BATTLE_CAP, power.modifier,
    ));
    remaining -= rate;
  }

  attacks.push(makeAttack(
    DayAttackType.Normal, DAY_ATTACK_LABEL.get(DayAttackType.Normal)!, 1, remaining,
    basePower, DAY_BATTLE_CAP, 1.0,
  ));
  return attacks;
}

function buildTorpedoScenarios(input: ShipScenarioInput): ScenarioAttack[] {
  const shipType = input.stype as ShipType;
  if (isCarrierType(shipType) || isBattleshipType(shipType)) return [];
  if (input.torpedo <= 0) return [];

  return [makeAttack(
    'torpedo_normal', '普通攻击', 1, 1,
    torpedoBasePower(input.torpedo, torpedoImprovementBonus(input.equips)), TORPEDO_BATTLE_CAP, 1.0,
  )];
}

function buildAntiSubmarineScenarios(input: ShipScenarioInput, counts: EquipCounts): ScenarioAttack[] {
  const shipType = input.stype as ShipType;
  if (!canUseAntiSubmarineAttack(shipType, counts)) return [];
  if (input.asw <= 0 && counts.aswPowerEquipTotal <= 0) return [];

  const basePower = antiSubmarineBasePower(
    input.asw,
    counts.aswEquipTotal,
    counts.aswPowerEquipTotal,
    antiSubmarineImprovementBonus(input.equips),
    counts.aswAircraft > 0,
  ) * antiSubmarineSynergyModifier(counts);

  return [makeAttack(
    'asw_normal', '普通攻击', 1, 1,
    basePower, ANTI_SUBMARINE_CAP, 1.0,
  )];
}

function buildNightScenarios(input: ShipScenarioInput, counts: EquipCounts): ScenarioAttack[] {
  const shipType = input.stype as ShipType;
  const carrier = isCarrierType(shipType);
  if (carrier && counts.nightPlane <= 0 && !isUnconditionalNightCarrier(input)) return [];
  if (input.firepower + input.torpedo <= 0) return [];

  const basePower = carrier && counts.nightPlane > 0
    ? buildCarrierNightBasePower(input)
    : nightBasePower(input.firepower, input.torpedo, nightImprovementBonus(input.equips));
  const types = detectNightAttacks(input, counts);
  const damageState = getDamageState(input.hpNow, Math.max(1, input.hpMax));

  const attacks: ScenarioAttack[] = [];
  let remaining = 1;
  for (const type of types) {
    const power = nightAttackPower(type, counts);
    const result = calcNightCutInRate({
      luck: input.luck,
      level: input.level,
      position: input.isFlagship ? ShipPosition.Flagship : ShipPosition.Second,
      damageState,
      cutInType: type,
      fleetBonus: {
        searchlightActive: input.fleetSearchlight,
        starShellActive: input.fleetStarShell,
        nightReconActive: false,
      },
      shipBonus: {
        hasSkilledLookout: counts.lookout > 0,
        hasSurfaceRadarLookout: false,
        hasLoS5RadarExpansion: false,
        dGunCount: 0,
      },
    });
    const rate = remaining * (result.rate / 100);
    attacks.push(makeNightAttack(
      type, NIGHT_ATTACK_LABEL.get(type) ?? type, power.hits, rate,
      basePower, power.modifier,
    ));
    remaining -= rate;
  }

  attacks.push(makeNightAttack(
    'night_normal', '普通攻击', 1, remaining,
    basePower, 1.0,
  ));
  return attacks;
}

/**
 * Build the attack scenario table for one ship (昼战 / 雷击 / 对潜 / 夜战).
 */
export function buildShipBattleScenarios(input: ShipScenarioInput): ShipBattleScenarios {
  const counts = countEquips(input.equips);
  return {
    day: buildDayScenarios(input, counts),
    torpedo: buildTorpedoScenarios(input),
    asw: buildAntiSubmarineScenarios(input, counts),
    night: buildNightScenarios(input, counts),
  };
}
