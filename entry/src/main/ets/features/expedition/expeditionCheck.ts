import { SlotItemEquipType } from '../../domain/models/struct/slotitem';
import type { GameState, ShipState } from '../state';

export interface ExpeditionName {
  jp?: string;
  ko?: string;
  en?: string;
  scn?: string;
  tcn?: string;
}

export interface ExpeditionRewardItem {
  itemtype: number;
  max_number: number;
}

export interface ExpeditionShiptypeRule {
  shiptype: number[];
  count: number;
}

export interface ExpeditionExtraRequirement {
  firepower?: number;
  aa?: number;
  asw?: number;
  los?: number;
}

export interface ExpeditionRequirement {
  id: number;
  code: string;
  area: number;
  name: ExpeditionName;
  reward_fuel: number;
  reward_bullet: number;
  reward_steel: number;
  reward_alum: number;
  reward_items: ExpeditionRewardItem[];
  flagship_lv: number;
  fleet_lv: number;
  flagship_shiptype: number;
  ship_count: number;
  drum_ship_count: number;
  drum_count: number;
  required_shiptypes: ExpeditionShiptypeRule[];
  required_shiptype_schemes?: ExpeditionShiptypeRule[][];
  required_extra: ExpeditionExtraRequirement;
  big_success: object | null;
}

export interface ExpeditionFleetSummary {
  deckId: number;
  shipCount: number;
  flagshipLv: number;
  flagshipShiptype: number;
  levelSum: number;
  firepower: number;
  aa: number;
  asw: number;
  los: number;
  drumCount: number;
  drumCarrierCount: number;
  sparkledCount: number;
  allSparkled: boolean;
  higherLevelThanFlagshipCount: number;
}

export interface ExpeditionBigSuccessResult {
  kind: string;
  rate: number;
  rawRate: number;
  ok: boolean;
  note: string;
}

export interface ExpeditionCheckResult {
  deckId: number;
  ok: boolean;
  missing: string[];
  summary: ExpeditionFleetSummary;
  bigSuccess: ExpeditionBigSuccessResult;
}

const DRUM_MASTER_ID = 75;
const SPARKLE_COND = 50;
const CVE_SHIPTYPE = 27;

const KNOWN_AREAS: Set<number> = new Set([1, 2, 3, 4, 5, 7]);

const MORALE_REQUIREMENTS: Record<number, number> = {
  1: 28,
  2: 13,
  3: 22,
  6: 1,
};

const OVERDRUM_BIG_SUCCESS: Record<number, { min: number; max: number }> = {
  21: { min: 3, max: 4 },
  24: { min: 0, max: 2 },
  37: { min: 4, max: 5 },
  38: { min: 8, max: 10 },
  40: { min: 0, max: 4 },
  44: { min: 6, max: 8 },
  142: { min: 4, max: 6 },
};

const FLAGSHIP_BIG_SUCCESS: Set<number> = new Set([
  101, 102, 103, 104, 105, 112, 113, 114, 115,
  41, 43, 45, 46, 32, 131, 132, 133, 141,
]);

const CVE_NAME_PARTS: string[] = [
  '大鷹',
  '神鷹',
  '雲鷹',
  '鳳鷹',
  'Gambier Bay',
  'Langley',
  '瑞鳳改二乙',
];

const SHIPTYPE_LABELS: Record<number, string> = {
  1: '海防',
  2: '驱逐',
  3: '轻巡',
  4: '雷巡',
  5: '重巡',
  6: '航巡',
  7: '轻母',
  8: '高战',
  9: '战舰',
  10: '航战',
  11: '正母',
  13: '潜水',
  14: '潜母',
  16: '水母',
  18: '装母',
  20: '潜母艦',
  21: '练巡',
  27: '护卫空母',
};

function r(shiptype: number[], count: number): ExpeditionShiptypeRule {
  return { shiptype, count };
}

function s(...rules: ExpeditionShiptypeRule[]): ExpeditionShiptypeRule[] {
  return rules;
}

const DE = [1];
const DD = [2];
const DD_OR_DE = [1, 2];
const CL = [3];
const CVL = [7];
const CT = [21];
const CVE = [27];

const ESCORT_SPECIAL_2: ExpeditionShiptypeRule[][] = [
  s(r(CL, 1), r(DD_OR_DE, 2)),
  s(r(DD, 1), r(DE, 3)),
  s(r(CL, 1), r(DE, 2)),
  s(r(CT, 1), r(DE, 2)),
  s(r(CVE, 1), r(DE, 2)),
  s(r(CVE, 1), r(DD, 2)),
];

const KNOWN_COMPOSITION_SCHEMES: Record<number, ExpeditionShiptypeRule[][]> = {
  4: ESCORT_SPECIAL_2,
  5: ESCORT_SPECIAL_2,
  9: ESCORT_SPECIAL_2,
  42: ESCORT_SPECIAL_2,
  102: [
    s(r(CL, 1), r(DD_OR_DE, 3)),
    s(r(CL, 1), r(DE, 2)),
    s(r(DD, 1), r(DE, 3)),
    s(r(CT, 1), r(DE, 2)),
    s(r(CVE, 1), r(DD, 2)),
    s(r(CVE, 1), r(DE, 2)),
  ],
  103: [
    s(r(CL, 1), r(DD, 2)),
    s(r(CL, 1), r(DE, 2)),
    s(r(DD, 1), r(DE, 3)),
    s(r(CT, 1), r(DE, 2)),
    s(r(CVE, 1), r(DD, 2)),
    s(r(CVE, 1), r(DE, 2)),
  ],
  104: [
    s(r(CL, 1), r(DD, 3)),
    s(r(CL, 1), r(DE, 2)),
    s(r(DD, 1), r(DE, 3)),
    s(r(CT, 1), r(DE, 2)),
    s(r(CVE, 1), r(DD, 2)),
    s(r(CVE, 1), r(DE, 2)),
  ],
  105: [
    s(r(CL, 1), r(DD, 3)),
    s(r(CL, 1), r(DE, 2)),
    s(r(DD, 1), r(DE, 3)),
    s(r(CT, 1), r(DE, 2)),
    s(r(CVE, 1), r(DD, 2)),
    s(r(CVE, 1), r(DE, 2)),
  ],
  43: [
    s(r(CVE, 1), r(DD, 2)),
    s(r(CVE, 1), r(DE, 2)),
    s(r(CVL, 1), r(CL, 1), r(DD, 4)),
    s(r(CVL, 1), r(CL, 1), r(DE, 2)),
    s(r(CVL, 1), r(DD, 1), r(DE, 3)),
    s(r(CVL, 1), r(CT, 1), r(DE, 2)),
    s(r(CVL, 1), r(CVE, 1), r(DD, 2)),
    s(r(CVL, 1), r(CVE, 1), r(DE, 2)),
  ],
  45: [
    s(r(CVE, 1), r(DD_OR_DE, 4)),
    s(r(CVL, 1), r(DD_OR_DE, 4)),
  ],
};

function activeSlotUids(ship: ShipState): number[] {
  const result: number[] = [];
  for (let i = 0; i < ship.slotCount; i++) {
    const uid = ship.slots[i] ?? -1;
    if (uid > 0) result.push(uid);
  }
  if (ship.exSlot > 0) result.push(ship.exSlot);
  return result;
}

function isAswIgnoredRecon(equipType: number): boolean {
  return equipType === SlotItemEquipType.CarrierRecon
    || equipType === SlotItemEquipType.CarrierReconII
    || equipType === SlotItemEquipType.SeaplaneRecon
    || equipType === SlotItemEquipType.SeaplaneBomber
    || equipType === SlotItemEquipType.SeaplaneFighter
    || equipType === SlotItemEquipType.LargeFlyingBoat;
}

function shipIgnoredReconAsw(ship: ShipState, st: Readonly<GameState>): number {
  let total = 0;
  for (const uid of activeSlotUids(ship)) {
    const masterId = st.slotItemIndex.get(uid);
    if (masterId === undefined) continue;
    const equipType = st.slotItemEquipTypes.get(masterId) ?? 0;
    if (isAswIgnoredRecon(equipType)) {
      total += st.slotItemAsw.get(masterId) ?? 0;
    }
  }
  return total;
}

function countDrums(ship: ShipState, st: Readonly<GameState>): number {
  let count = 0;
  for (const uid of activeSlotUids(ship)) {
    if ((st.slotItemIndex.get(uid) ?? 0) === DRUM_MASTER_ID) {
      count++;
    }
  }
  return count;
}

function isCveShip(ship: ShipState, st: Readonly<GameState>): boolean {
  const stype = st.shipMasterStype.get(ship.masterId) ?? 0;
  if (stype !== 7) return false;
  for (const part of CVE_NAME_PARTS) {
    if (ship.name.indexOf(part) >= 0) return true;
  }
  return false;
}

function shiptypeOf(ship: ShipState, st: Readonly<GameState>): number {
  return isCveShip(ship, st) ? CVE_SHIPTYPE : (st.shipMasterStype.get(ship.masterId) ?? 0);
}

function shipMatchesType(ship: ShipState, typeId: number, st: Readonly<GameState>): boolean {
  if (typeId === CVE_SHIPTYPE) return isCveShip(ship, st);
  return (st.shipMasterStype.get(ship.masterId) ?? 0) === typeId;
}

function groupCandidates(
  group: ExpeditionShiptypeRule,
  ships: ReadonlyArray<ShipState>,
  st: Readonly<GameState>,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < ships.length; i++) {
    for (const typeId of group.shiptype) {
      if (shipMatchesType(ships[i], typeId, st)) {
        result.push(i);
        break;
      }
    }
  }
  return result;
}

function chooseCandidates(
  candidates: ReadonlyArray<number>,
  needed: number,
  start: number,
  used: ReadonlySet<number>,
  picked: Set<number>,
  onChosen: (nextUsed: Set<number>) => boolean,
): boolean {
  if (picked.size >= needed) {
    const next = new Set<number>(used);
    picked.forEach(v => next.add(v));
    return onChosen(next);
  }
  for (let i = start; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (used.has(candidate) || picked.has(candidate)) continue;
    picked.add(candidate);
    if (chooseCandidates(candidates, needed, i + 1, used, picked, onChosen)) {
      return true;
    }
    picked.delete(candidate);
  }
  return false;
}

function schemeMatches(
  scheme: ReadonlyArray<ExpeditionShiptypeRule>,
  ships: ReadonlyArray<ShipState>,
  st: Readonly<GameState>,
): boolean {
  if (scheme.length === 0) return true;
  const groups = scheme
    .map(group => ({ group, candidates: groupCandidates(group, ships, st) }))
    .sort((a, b) => a.candidates.length - b.candidates.length);

  for (const info of groups) {
    if (info.candidates.length < info.group.count) return false;
  }

  const assign = (idx: number, used: Set<number>): boolean => {
    if (idx >= groups.length) return true;
    const info = groups[idx];
    return chooseCandidates(
      info.candidates,
      info.group.count,
      0,
      used,
      new Set<number>(),
      (nextUsed: Set<number>): boolean => assign(idx + 1, nextUsed),
    );
  };
  return assign(0, new Set<number>());
}

function compositionSchemes(req: ExpeditionRequirement): ExpeditionShiptypeRule[][] {
  const knownSchemes = KNOWN_COMPOSITION_SCHEMES[req.id];
  if (knownSchemes !== undefined) return knownSchemes;
  if (req.required_shiptype_schemes && req.required_shiptype_schemes.length > 0) {
    return req.required_shiptype_schemes;
  }
  return [req.required_shiptypes ?? []];
}

function compositionMatches(
  req: ExpeditionRequirement,
  ships: ReadonlyArray<ShipState>,
  st: Readonly<GameState>,
): boolean {
  const schemes = compositionSchemes(req);
  for (const scheme of schemes) {
    if (schemeMatches(scheme, ships, st)) return true;
  }
  return false;
}

function summarizeFleet(deckId: number, st: Readonly<GameState>): ExpeditionFleetSummary {
  const deck = st.decks.find(d => d.deckId === deckId);
  const ships: ShipState[] = deck
    ? deck.shipUids
      .filter(uid => uid > 0)
      .map(uid => st.ships.get(uid))
      .filter((ship): ship is ShipState => ship !== undefined)
    : [];

  let firepower = 0;
  let aa = 0;
  let asw = 0;
  let los = 0;
  let levelSum = 0;
  let drumCount = 0;
  let drumCarrierCount = 0;
  let sparkledCount = 0;
  const flagshipLv = ships[0]?.level ?? 0;

  for (const ship of ships) {
    firepower += Math.max(0, ship.fireCur || 0);
    aa += Math.max(0, ship.aaCur || 0);
    asw += Math.max(0, (ship.aswCur || 0) - shipIgnoredReconAsw(ship, st));
    los += Math.max(0, ship.scoutCur || 0);
    levelSum += Math.max(0, ship.level || 0);
    const shipDrums = countDrums(ship, st);
    drumCount += shipDrums;
    if (shipDrums > 0) drumCarrierCount++;
    if (ship.cond >= SPARKLE_COND) sparkledCount++;
  }

  return {
    deckId,
    shipCount: ships.length,
    flagshipLv,
    flagshipShiptype: ships.length > 0 ? shiptypeOf(ships[0], st) : 0,
    levelSum,
    firepower,
    aa,
    asw,
    los,
    drumCount,
    drumCarrierCount,
    sparkledCount,
    allSparkled: ships.length > 0 && sparkledCount === ships.length,
    higherLevelThanFlagshipCount: ships.filter(ship => ship.level > flagshipLv).length,
  };
}

function capRate(rawRate: number): number {
  if (!Number.isFinite(rawRate) || rawRate < 0) return 0;
  return Math.min(100, rawRate);
}

function normalizedRate(score: number): number {
  return Math.round(score / 0.0099) / 100;
}

function evalBigSuccess(req: ExpeditionRequirement, summary: ExpeditionFleetSummary): ExpeditionBigSuccessResult {
  const overdrum = OVERDRUM_BIG_SUCCESS[req.id];
  if (overdrum !== undefined) {
    let score = 0;
    if (summary.drumCount >= overdrum.max) {
      score = summary.sparkledCount * 15 + 40;
    } else if (overdrum.min === 0) {
      score = summary.sparkledCount * 15 + 20;
    } else if (summary.drumCount >= overdrum.min) {
      score = summary.sparkledCount * 15 + 5;
    }
    const rawRate = normalizedRate(score);
    return {
      kind: 'drum',
      rate: capRate(rawRate),
      rawRate,
      ok: rawRate >= 100,
      note: `鼓${summary.drumCount}/${overdrum.max}`,
    };
  }

  if (FLAGSHIP_BIG_SUCCESS.has(req.id)) {
    const score = summary.sparkledCount * 15 + 15
      + Math.floor(Math.sqrt(summary.flagshipLv) + summary.flagshipLv / 10);
    const rawRate = normalizedRate(score);
    const higherOk = rawRate >= 100 || summary.higherLevelThanFlagshipCount === 0;
    return {
      kind: 'flagship',
      rate: capRate(rawRate),
      rawRate,
      ok: rawRate >= 100 && higherOk,
      note: higherOk ? '旗舰型' : '有高Lv僚舰',
    };
  }

  const rawRate = summary.allSparkled
    ? normalizedRate(summary.shipCount * 15 + 20)
    : 0;
  return {
    kind: 'normal',
    rate: capRate(rawRate),
    rawRate,
    ok: rawRate >= 100,
    note: summary.allSparkled ? '全闪' : '需全闪',
  };
}

function pushMinRequirement(missing: string[], label: string, actual: number, required: number): void {
  if (required > 0 && actual < required) {
    missing.push(`${label}${actual}/${required}`);
  }
}

export function evaluateExpedition(
  req: ExpeditionRequirement,
  deckId: number,
  st: Readonly<GameState>,
): ExpeditionCheckResult {
  const deck = st.decks.find(d => d.deckId === deckId);
  const ships: ShipState[] = deck
    ? deck.shipUids
      .filter(uid => uid > 0)
      .map(uid => st.ships.get(uid))
      .filter((ship): ship is ShipState => ship !== undefined)
    : [];
  const summary = summarizeFleet(deckId, st);
  const missing: string[] = [];

  if (!deck || ships.length === 0) {
    missing.push('无舰队');
  }

  pushMinRequirement(missing, '舰数', summary.shipCount, req.ship_count);
  pushMinRequirement(missing, '旗Lv', summary.flagshipLv, req.flagship_lv);
  pushMinRequirement(missing, '总Lv', summary.levelSum, req.fleet_lv);
  pushMinRequirement(missing, '鼓舰', summary.drumCarrierCount, req.drum_ship_count);
  pushMinRequirement(missing, '鼓桶', summary.drumCount, req.drum_count);

  if (req.flagship_shiptype > 0 && ships.length > 0 && !shipMatchesType(ships[0], req.flagship_shiptype, st)) {
    missing.push(`旗舰${shiptypeLabel(req.flagship_shiptype)}`);
  }

  if ((req.required_shiptypes?.length ?? 0) > 0 && !compositionMatches(req, ships, st)) {
    missing.push(`编成${formatShiptypeRules(req.required_shiptypes)}`);
  }

  const extra = req.required_extra ?? {};
  pushMinRequirement(missing, '火力', summary.firepower, extra.firepower ?? 0);
  pushMinRequirement(missing, '对空', summary.aa, extra.aa ?? 0);
  pushMinRequirement(missing, '对潜', summary.asw, extra.asw ?? 0);
  pushMinRequirement(missing, '索敌', summary.los, extra.los ?? 0);

  const moraleReq = MORALE_REQUIREMENTS[req.id] ?? 0;
  if (moraleReq > 0) {
    const lowMorale = ships.filter(ship => ship.cond < moraleReq).length;
    if (lowMorale > 0) missing.push(`士气${moraleReq}+`);
  }

  const needSupply = ships.filter(ship => ship.needsResupply).length;
  if (needSupply > 0) missing.push(`补给${needSupply}`);

  return {
    deckId,
    ok: missing.length === 0,
    missing,
    summary,
    bigSuccess: evalBigSuccess(req, summary),
  };
}

export function shiptypeLabel(typeId: number): string {
  return SHIPTYPE_LABELS[typeId] ?? `舰种${typeId}`;
}

export function formatShiptypeRules(rules: ReadonlyArray<ExpeditionShiptypeRule>): string {
  const parts: string[] = [];
  for (const rule of rules) {
    const types = rule.shiptype.map(shiptypeLabel).join('/');
    parts.push(`${types}${rule.count}`);
  }
  return parts.join(' ');
}

export function displayExpeditionName(req: ExpeditionRequirement): string {
  return req.name?.scn ?? req.name?.jp ?? req.name?.en ?? `远征 ${req.id}`;
}

export function isKnownExpeditionArea(area: number): boolean {
  return KNOWN_AREAS.has(area);
}

export function formatBigSuccessRate(rate: number): string {
  if (rate >= 99.95) return '100%';
  if (rate <= 0) return '0%';
  return `${rate.toFixed(1)}%`;
}

export function formatReward(req: ExpeditionRequirement): string {
  const resources: string[] = [];
  if (req.reward_fuel > 0) resources.push(`燃${req.reward_fuel}`);
  if (req.reward_bullet > 0) resources.push(`弹${req.reward_bullet}`);
  if (req.reward_steel > 0) resources.push(`钢${req.reward_steel}`);
  if (req.reward_alum > 0) resources.push(`铝${req.reward_alum}`);
  return resources.length > 0 ? resources.join(' ') : '无资源';
}
