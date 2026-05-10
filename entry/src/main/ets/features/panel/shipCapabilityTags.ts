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
  canOpeningASW,
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
  exSlot: number;
  slotItemIndex: Map<number, number>;
  slotItemEquipTypes: Map<number, number>;
  slotItemIconTypes: Map<number, number>;
  slotItemLos: Map<number, number>;
  slotItemAa: Map<number, number>;
  slotItemAsw: Map<number, number>;
  slotItemNames: Map<number, string>;
}

function slotUids(slots: number[], exSlot: number): number[] {
  const result: number[] = [];
  for (const uid of slots) {
    if (uid > 0) {
      result.push(uid);
    }
  }
  if (exSlot > 0) {
    result.push(exSlot);
  }
  return result;
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

function collectMasters(ctx: ShipCapabilityTagContext): SlotItemMaster[] {
  const masters: SlotItemMaster[] = [];
  for (const uid of slotUids(ctx.slots, ctx.exSlot)) {
    const master = toSlotItemMaster(uid, ctx);
    if (master !== null) {
      masters.push(master);
    }
  }
  return masters;
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

function supportsOpeningAsw(stype: number, aswCur: number, masters: SlotItemMaster[]): boolean {
  const shipType = stype as ShipType;
  if (!canOpeningASW(shipType) && shipType !== ShipType.CLT) {
    return false;
  }

  const sonarTypes: ReadonlySet<SlotItemEquipType> = new Set([
    SlotItemEquipType.Sonar,
    SlotItemEquipType.LargeSonar,
  ]);
  const depthChargeTypes: ReadonlySet<SlotItemEquipType> = new Set([
    SlotItemEquipType.DepthCharge,
  ]);
  const aswAircraftTypes: ReadonlySet<SlotItemEquipType> = new Set([
    SlotItemEquipType.Autogyro,
    SlotItemEquipType.AntiSubPatrol,
  ]);

  const sonarCount = countEquipTypes(masters, sonarTypes);
  const depthChargeCount = countEquipTypes(masters, depthChargeTypes);
  const aswAircraftCount = countEquipTypes(masters, aswAircraftTypes);
  const hasAswAircraft = aswAircraftCount > 0 || masters.some(master => master.type.equipType === SlotItemEquipType.CarrierTorpedoBomber && master.stats.asw > 0);

  if (shipType === ShipType.DE) {
    return aswCur >= 60 && (sonarCount > 0 || depthChargeCount > 0);
  }
  if (shipType === ShipType.CVL || shipType === ShipType.AV) {
    return aswCur >= 65 && hasAswAircraft;
  }

  return aswCur >= 100 && sonarCount > 0;
}

export function buildShipCapabilityTags(ctx: ShipCapabilityTagContext): string[] {
  const masters = collectMasters(ctx);
  const tags: string[] = [];

  if (detectAacis(ctx.shipMasterId, ctx.stype, ctx.ctype, masters).length > 0) {
    tags.push(AACI_TAG);
  }
  if (supportsNightCutIn(ctx.stype, masters)) {
    tags.push(NIGHT_CI_TAG);
  }
  if (supportsOpeningAsw(ctx.stype, ctx.aswCur, masters)) {
    tags.push(OPENING_ASW_TAG);
  }

  return tags;
}
