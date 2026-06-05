import { detectAacis } from '../calc/aaci';
import {
  SlotItemAircraftCategory,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemMajorType,
  SlotItemMaster,
  SlotItemMasterStats,
  ShipType,
  isCarrierType,
  isSubmarineType,
} from '../../domain/models';

const AACI_TAG = '対空CI';
const NIGHT_CI_TAG = '夜戦CI';
const OPENING_ASW_TAG = '先制対潜';

const EMPTY_STATS: SlotItemMasterStats = {
  hp: 0,
  armor: 0,
  firepower: 0,
  torpedo: 0,
  speed: 0,
  bomb: 0,
  aa: 0,
  asw: 0,
  hit: 0,
  evasion: 0,
  los: 0,
  luck: 0,
};

export interface ShipCapabilityTagContext {
  shipMasterId: number;
  stype: number;
  ctype: number;
  aswCur: number;
  slots: number[];
  onslot: number[];
  exSlot: number;
  slotItemIndex: Map<number, number>;
  slotItemEquipTypes: Map<number, number>;
  slotItemIconTypes: Map<number, number>;
  slotItemLos: Map<number, number>;
  slotItemAa: Map<number, number>;
  slotItemAsw: Map<number, number>;
  slotItemNames: Map<number, string>;
}

interface EquippedMaster {
  master: SlotItemMaster;
  onslot: number;
}

function toSlotItemMaster(uid: number, ctx: ShipCapabilityTagContext): SlotItemMaster | null {
  const masterId = ctx.slotItemIndex.get(uid);
  if (masterId === undefined) {
    return null;
  }

  return {
    id: masterId,
    sortNo: 0,
    name: ctx.slotItemNames.get(masterId) ?? '',
    type: {
      major: SlotItemMajorType.Unknown,
      book: SlotItemBookCategory.Unknown,
      equipType: (ctx.slotItemEquipTypes.get(masterId) ?? SlotItemEquipType.Unknown) as SlotItemEquipType,
      iconId: (ctx.slotItemIconTypes.get(masterId) ?? SlotItemIconId.Unknown) as SlotItemIconId,
      aircraft: SlotItemAircraftCategory.NonAircraft,
    },
    rarity: 0,
    range: 0,
    stats: {
      ...EMPTY_STATS,
      aa: ctx.slotItemAa.get(masterId) ?? 0,
      asw: ctx.slotItemAsw.get(masterId) ?? 0,
      los: ctx.slotItemLos.get(masterId) ?? 0,
    },
    broken: [],
    updatedAt: 0,
  };
}

function collectEquips(ctx: ShipCapabilityTagContext): EquippedMaster[] {
  const equips: EquippedMaster[] = [];
  for (let i = 0; i < ctx.slots.length; i++) {
    const uid = ctx.slots[i];
    if (uid <= 0) {
      continue;
    }
    const master = toSlotItemMaster(uid, ctx);
    if (master !== null) {
      equips.push({ master, onslot: i < ctx.onslot.length ? ctx.onslot[i] : 0 });
    }
  }
  if (ctx.exSlot > 0) {
    const master = toSlotItemMaster(ctx.exSlot, ctx);
    if (master !== null) {
      equips.push({ master, onslot: 0 });
    }
  }
  return equips;
}

function collectMasters(equips: EquippedMaster[]): SlotItemMaster[] {
  return equips.map(equip => equip.master);
}

function countEquipTypes(masters: SlotItemMaster[], types: ReadonlySet<SlotItemEquipType>): number {
  let count = 0;
  for (const master of masters) {
    if (types.has(master.type.equipType)) {
      count++;
    }
  }
  return count;
}

function hasIcon(masters: SlotItemMaster[], iconId: SlotItemIconId): boolean {
  return masters.some(master => master.type.iconId === iconId);
}

function nameContains(name: string, fragments: string[]): boolean {
  return fragments.some(fragment => name.indexOf(fragment) >= 0);
}

const TAIYOU_CLASS_SPECIAL_IDS: ReadonlySet<number> = new Set([
  380, // 大鷹改
  529, // 大鷹改二
  381, // 神鷹改
  536, // 神鷹改二
  382, // 雲鷹改
  889, // 雲鷹改二
  646, // 加賀改二護
]);

const COMMON_CVL_EXCLUDED_IDS: ReadonlySet<number> = new Set([
  508, // 鈴谷航改二
  509, // 熊野航改二
]);

const FLEXIBLE_SONAR_CARRIER_IDS: ReadonlySet<number> = new Set([
  894, // 鳳翔改二
  899, // 鳳翔改二戦
  707, // Gambier Bay Mk.II
]);

const UNCONDITIONAL_OPENING_ASW_SHIP_IDS: ReadonlySet<number> = new Set([
  141,  // 五十鈴改二
  478,  // 龍田改二
  394,  // Jervis改
  893,  // Janus改
  681,  // Samuel B.Roberts改
  920,  // Samuel B.Roberts Mk.II
  562,  // Johnston
  689,  // Johnston改
  596,  // Fletcher
  692,  // Fletcher改
  628,  // Fletcher改 Mod.2
  629,  // Fletcher Mk.II
  624,  // 夕張改二丁
  1035, // 吹雪改三
  1040, // 吹雪改三護(六式)
]);

const EXCLUDED_ESCORT_IDS: ReadonlySet<number> = new Set([
  999, // Eidsvold
  739, // Eidsvold改
]);

const SOYA_AND_YAMASHIOMARU_IDS: ReadonlySet<number> = new Set([
  645, // 宗谷
  650, // 宗谷
  699, // 宗谷
  900, // 山汐丸
  717, // 山汐丸改
]);

const FUSO_YAMASHIRO_K2_IDS: ReadonlySet<number> = new Set([
  411, // 扶桑改二
  412, // 山城改二
]);

const KUMANOMARU_IDS: ReadonlySet<number> = new Set([
  943, // 熊野丸
  948, // 熊野丸改
]);

const YAMATO_K2_JU_SHINSHUMARU_KAI_IDS: ReadonlySet<number> = new Set([
  916, // 大和改二重
  626, // 神州丸改
]);

function supportsNightCutIn(stype: number, masters: SlotItemMaster[]): boolean {
  const mainGunTypes: ReadonlySet<SlotItemEquipType> = new Set([
    SlotItemEquipType.SmallCaliberMainGun,
    SlotItemEquipType.MediumCaliberMainGun,
    SlotItemEquipType.LargeCaliberMainGun,
    SlotItemEquipType.LargeCaliberMainGunII,
  ]);
  const torpedoTypes: ReadonlySet<SlotItemEquipType> = new Set([
    SlotItemEquipType.Torpedo,
    SlotItemEquipType.SubmarineTorpedo,
  ]);
  const radarTypes: ReadonlySet<SlotItemEquipType> = new Set([
    SlotItemEquipType.SmallRadar,
    SlotItemEquipType.LargeRadar,
    SlotItemEquipType.LargeRadarII,
  ]);

  const shipType = stype as ShipType;
  const mainGunCount = countEquipTypes(masters, mainGunTypes);
  const torpedoCount = countEquipTypes(masters, torpedoTypes);
  const secondaryCount = countEquipTypes(masters, new Set([SlotItemEquipType.SecondaryGun]));
  const radarCount = countEquipTypes(masters, radarTypes);
  const lookoutCount = countEquipTypes(masters, new Set([SlotItemEquipType.SurfaceShipPersonnel]));
  const hasNightAircraft = hasIcon(masters, SlotItemIconId.NightFighter) || hasIcon(masters, SlotItemIconId.NightAttacker);

  if (isCarrierType(shipType)) {
    return hasNightAircraft;
  }
  if (isSubmarineType(shipType)) {
    return torpedoCount >= 2;
  }

  if (torpedoCount >= 2) {
    return true;
  }
  if (mainGunCount >= 3 || (mainGunCount >= 2 && secondaryCount >= 1)) {
    return true;
  }
  if (mainGunCount >= 1 && secondaryCount >= 1) {
    return true;
  }
  if (mainGunCount >= 1 && torpedoCount >= 1) {
    return true;
  }
  if (shipType === ShipType.DD && mainGunCount >= 1 && torpedoCount >= 1 && radarCount >= 1) {
    return true;
  }
  return shipType === ShipType.DD && torpedoCount >= 2 && (mainGunCount >= 1 || lookoutCount >= 1);
}

function hasEquip(equips: EquippedMaster[], predicate: (master: SlotItemMaster) => boolean): boolean {
  return equips.some(equip => predicate(equip.master));
}

function hasEmbarkedEquip(equips: EquippedMaster[], predicate: (master: SlotItemMaster) => boolean): boolean {
  return equips.some(equip => equip.onslot > 0 && predicate(equip.master));
}

function whiteboardAswTotal(equips: EquippedMaster[]): number {
  return equips.reduce((sum, equip) => sum + equip.master.stats.asw, 0);
}

function isSonar(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.Sonar || master.type.equipType === SlotItemEquipType.LargeSonar;
}

function isZeroSonar(master: SlotItemMaster): boolean {
  return isSonar(master) && nameContains(master.name, ['零式水中', '零式水听', '零式水聴']);
}

function isDepthCharge(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.DepthCharge;
}

function isAutogyro(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.Autogyro;
}

function isAswPatrol(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.AntiSubPatrol;
}

function isCarrierTorpedo(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.CarrierTorpedoBomber;
}

function isCarrierDiveBomber(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.CarrierDiveBomber ||
    master.type.equipType === SlotItemEquipType.JetFighterBomber;
}

function isSeaplaneBomber(master: SlotItemMaster): boolean {
  return master.type.equipType === SlotItemEquipType.SeaplaneBomber;
}

function isAswAircraftAtLeast(master: SlotItemMaster, asw: number): boolean {
  return (isCarrierTorpedo(master) || isAswPatrol(master) || isAutogyro(master)) && master.stats.asw >= asw;
}

function isCarrierAttackOrDiveAswAtLeast(master: SlotItemMaster, asw: number): boolean {
  return (isCarrierTorpedo(master) || isCarrierDiveBomber(master)) && master.stats.asw >= asw;
}

function isTaiyouClassSpecial(shipMasterId: number): boolean {
  return TAIYOU_CLASS_SPECIAL_IDS.has(shipMasterId);
}

function isCommonCvlExcluded(shipMasterId: number): boolean {
  return COMMON_CVL_EXCLUDED_IDS.has(shipMasterId);
}

function isFlexibleSonarCarrier(shipMasterId: number): boolean {
  return FLEXIBLE_SONAR_CARRIER_IDS.has(shipMasterId);
}

function isUnconditionalOpeningAswShip(shipMasterId: number): boolean {
  return UNCONDITIONAL_OPENING_ASW_SHIP_IDS.has(shipMasterId);
}

function isExcludedEscort(shipMasterId: number): boolean {
  return EXCLUDED_ESCORT_IDS.has(shipMasterId);
}

function isStandardAsw100Ship(shipType: ShipType, shipMasterId: number): boolean {
  return shipType === ShipType.DD ||
    shipType === ShipType.CL ||
    shipType === ShipType.CT ||
    shipType === ShipType.CLT ||
    shipType === ShipType.AO ||
    SOYA_AND_YAMASHIOMARU_IDS.has(shipMasterId);
}

function supportsCommonCvlOpeningAsw(shipMasterId: number, aswCur: number, equips: EquippedMaster[]): boolean {
  if (isCommonCvlExcluded(shipMasterId) || isTaiyouClassSpecial(shipMasterId)) {
    return false;
  }

  const sonarOk = isFlexibleSonarCarrier(shipMasterId)
    ? hasEquip(equips, isSonar)
    : hasEquip(equips, isZeroSonar);
  const hasAsw7Aircraft = hasEmbarkedEquip(equips, master => isAswAircraftAtLeast(master, 7));
  const hasAsw1AttackAircraft = hasEmbarkedEquip(equips, master => isCarrierAttackOrDiveAswAtLeast(master, 1));

  if (aswCur >= 50 && sonarOk && hasAsw7Aircraft) {
    return true;
  }
  if (aswCur >= 65 && hasAsw7Aircraft) {
    return true;
  }
  return aswCur >= 100 && sonarOk && hasAsw1AttackAircraft;
}

function supportsOpeningAsw(ctx: ShipCapabilityTagContext, equips: EquippedMaster[]): boolean {
  const shipType = ctx.stype as ShipType;
  const shipMasterId = ctx.shipMasterId;
  const aswCur = ctx.aswCur;

  if (isUnconditionalOpeningAswShip(shipMasterId)) {
    return true;
  }

  if (isStandardAsw100Ship(shipType, shipMasterId)) {
    return aswCur >= 100 && hasEquip(equips, isSonar);
  }

  if (shipType === ShipType.DE && !isExcludedEscort(shipMasterId)) {
    return (aswCur >= 60 && hasEquip(equips, isSonar)) ||
      (aswCur >= 75 && whiteboardAswTotal(equips) >= 4);
  }

  if (isTaiyouClassSpecial(shipMasterId)) {
    return hasEmbarkedEquip(equips, master =>
      (isCarrierTorpedo(master) || isCarrierDiveBomber(master) || isAswPatrol(master) || isAutogyro(master)) &&
        master.stats.asw >= 1);
  }

  if (shipType === ShipType.CVL) {
    return supportsCommonCvlOpeningAsw(shipMasterId, aswCur, equips);
  }

  if (FUSO_YAMASHIRO_K2_IDS.has(shipMasterId)) {
    return aswCur >= 100 &&
      hasEquip(equips, isZeroSonar) &&
      (hasEmbarkedEquip(equips, master => isSeaplaneBomber(master) || isAutogyro(master)) ||
        hasEquip(equips, isDepthCharge));
  }

  if (KUMANOMARU_IDS.has(shipMasterId)) {
    return aswCur >= 100 &&
      hasEquip(equips, isSonar) &&
      hasEmbarkedEquip(equips, master =>
        (isCarrierDiveBomber(master) || isAutogyro(master) || isAswPatrol(master)) && master.stats.asw >= 1);
  }

  if (YAMATO_K2_JU_SHINSHUMARU_KAI_IDS.has(shipMasterId)) {
    return aswCur >= 100 &&
      hasEquip(equips, isSonar) &&
      hasEmbarkedEquip(equips, master => isSeaplaneBomber(master) || isAutogyro(master));
  }

  if (shipMasterId === 554) {
    const kaObservationCount = equips.filter(equip =>
      nameContains(equip.master.name, ['カ号観測機', 'Ｏ号観測機', 'O号観測機', 'O号观测机'])).length;
    const s51Count = equips.filter(equip =>
      nameContains(equip.master.name, ['S-51J'])).length;
    return kaObservationCount >= 2 || s51Count >= 1;
  }

  return false;
}

export function buildShipCapabilityTags(ctx: ShipCapabilityTagContext): string[] {
  const equips = collectEquips(ctx);
  const masters = collectMasters(equips);
  const tags: string[] = [];

  if (detectAacis(ctx.shipMasterId, ctx.stype, ctx.ctype, masters).length > 0) {
    tags.push(AACI_TAG);
  }
  if (supportsNightCutIn(ctx.stype, masters)) {
    tags.push(NIGHT_CI_TAG);
  }
  if (supportsOpeningAsw(ctx, equips)) {
    tags.push(OPENING_ASW_TAG);
  }

  return tags;
}
