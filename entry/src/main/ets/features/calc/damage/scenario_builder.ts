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
  DAY_BATTLE_CAP,
  NIGHT_BATTLE_CAP,
  TORPEDO_BATTLE_CAP,
  criticalPower,
  dayCarrierBasePower,
  daySurfaceBasePower,
  finalAttackPower,
  nightBasePower,
  torpedoBasePower,
} from './attack_power';
import { calcDayAttackRate, calcObservationTerm } from './day_attack_rate';
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
  /** Embarked 艦戦 (incl. jet fighters) */
  carrierFighter: number;
  /** Embarked 艦爆 (incl. jet fighter-bombers) */
  carrierDiveBomber: number;
  /** Embarked 艦攻 */
  carrierTorpedoBomber: number;
  /** Embarked night fighters/attackers */
  nightPlane: number;
  /** Σ equipment 爆装 */
  bombTotal: number;
}

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

function countEquips(equips: ReadonlyArray<ScenarioEquip>): EquipCounts {
  const counts: EquipCounts = {
    mainGun: 0, secondaryGun: 0, torpedo: 0, radar: 0, surfaceRadar: 0,
    apShell: 0, lookout: 0, spottingPlane: 0, carrierFighter: 0,
    carrierDiveBomber: 0, carrierTorpedoBomber: 0, nightPlane: 0, bombTotal: 0,
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

    const embarked = eq.onslot > 0;
    if (embarked && (t === SlotItemEquipType.SeaplaneRecon || t === SlotItemEquipType.SeaplaneBomber)) {
      counts.spottingPlane += 1;
    }
    if (embarked && (t === SlotItemEquipType.CarrierFighter || t === SlotItemEquipType.JetFighter)) {
      counts.carrierFighter += 1;
    }
    if (embarked && (t === SlotItemEquipType.CarrierDiveBomber || t === SlotItemEquipType.JetFighterBomber)) {
      counts.carrierDiveBomber += 1;
    }
    if (embarked && t === SlotItemEquipType.CarrierTorpedoBomber) {
      counts.carrierTorpedoBomber += 1;
    }
    if (embarked && (eq.iconType === SlotItemIconId.NightFighter || eq.iconType === SlotItemIconId.NightAttacker)) {
      counts.nightPlane += 1;
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
]);

/** Post-cap power modifier and hit count per night attack type. */
const NIGHT_ATTACK_POWER = new Map<NightCutInType, { modifier: number; hits: number }>([
  [NightCutInType.DoubleAttack, { modifier: 1.2, hits: 2 }],
  [NightCutInType.MainTorpRadarCI, { modifier: 1.3, hits: 2 }],
  [NightCutInType.TorpTorpLookoutCI, { modifier: 1.5, hits: 2 }],
  [NightCutInType.TorpedoCI, { modifier: 1.5, hits: 2 }],
  [NightCutInType.MainGunCI, { modifier: 2.0, hits: 1 }],
  [NightCutInType.MainSecondaryCI, { modifier: 1.75, hits: 1 }],
  [NightCutInType.MainTorpCI, { modifier: 1.3, hits: 2 }],
  // 夜襲CI has several variants (×1.18~1.25, up to 3 hits); use a single estimate.
  [NightCutInType.CarrierNightCI, { modifier: 1.25, hits: 2 }],
]);

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
  if (counts.carrierFighter >= 1) types.push(DayAttackType.CarrierFBA);
  if (counts.carrierDiveBomber >= 2) types.push(DayAttackType.CarrierBBA);
  types.push(DayAttackType.CarrierBA);
  return types;
}

/**
 * Night attacks available to the ship, ordered by selection priority
 * (DD-exclusive cut-ins roll first, then generic cut-ins, then 連撃).
 */
function detectNightAttacks(stype: number, counts: EquipCounts): NightCutInType[] {
  const shipType = stype as ShipType;
  const types: NightCutInType[] = [];

  if (isCarrierType(shipType)) {
    if (counts.nightPlane > 0) types.push(NightCutInType.CarrierNightCI);
    return types;
  }

  if (shipType === ShipType.DD) {
    if (counts.mainGun >= 1 && counts.torpedo >= 1 && counts.surfaceRadar >= 1) {
      types.push(NightCutInType.MainTorpRadarCI);
    }
    if (counts.torpedo >= 2 && counts.lookout >= 1) {
      types.push(NightCutInType.TorpTorpLookoutCI);
    }
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

function buildDayScenarios(input: ShipScenarioInput, counts: EquipCounts): ScenarioAttack[] {
  const shipType = input.stype as ShipType;
  if (isSubmarineType(shipType)) return [];

  const carrier = isCarrierType(shipType);
  const basePower = carrier
    ? dayCarrierBasePower(input.firepower, input.torpedo, counts.bombTotal)
    : daySurfaceBasePower(input.firepower);

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

  attacks.unshift(makeAttack(
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
    torpedoBasePower(input.torpedo), TORPEDO_BATTLE_CAP, 1.0,
  )];
}

function buildNightScenarios(input: ShipScenarioInput, counts: EquipCounts): ScenarioAttack[] {
  const shipType = input.stype as ShipType;
  const carrier = isCarrierType(shipType);
  if (carrier && counts.nightPlane <= 0) return [];
  if (input.firepower + input.torpedo <= 0) return [];

  const basePower = nightBasePower(input.firepower, input.torpedo);
  const types = detectNightAttacks(input.stype, counts);
  const damageState = getDamageState(input.hpNow, Math.max(1, input.hpMax));

  const attacks: ScenarioAttack[] = [];
  let remaining = 1;
  for (const type of types) {
    const power = NIGHT_ATTACK_POWER.get(type)!;
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
    attacks.push(makeAttack(
      type, NIGHT_ATTACK_LABEL.get(type) ?? type, power.hits, rate,
      basePower, NIGHT_BATTLE_CAP, power.modifier,
    ));
    remaining -= rate;
  }

  attacks.unshift(makeAttack(
    'night_normal', '普通攻击', 1, remaining,
    basePower, NIGHT_BATTLE_CAP, 1.0,
  ));
  return attacks;
}

/**
 * Build the attack scenario table for one ship (昼战 / 雷击 / 夜战).
 */
export function buildShipBattleScenarios(input: ShipScenarioInput): ShipBattleScenarios {
  const counts = countEquips(input.equips);
  return {
    day: buildDayScenarios(input, counts),
    torpedo: buildTorpedoScenarios(input),
    night: buildNightScenarios(input, counts),
  };
}
