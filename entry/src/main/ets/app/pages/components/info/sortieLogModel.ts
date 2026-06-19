/**
 * 出击日志 — 纯逻辑模型层（无 ArkUI 依赖）
 *
 * 负责：
 *  - 把持久化的我方舰娘快照 (ShipSnapshot) 转换为 ShipRow 可消费的 ShipItem；
 *  - 解析敌方舰队信息；
 *  - 基于 BattleSegment 的 start HP 逐次回放每一次攻击，产出「交战步骤」列表
 *    （含每次攻击后目标的血量），供详情页渲染血条演示；
 *  - 各阶段（航空 / 支援 / 开幕雷击 / 炮击 / 夜战）概要统计；
 *  - 列表行所需的时间 / 海域 / 结果格式化。
 */

import { ShipItem } from '../../../../features/panel/type';
import {
  getSlotItemMasterEquipType,
  getSlotItemMasterIconType,
  getShipMasterName,
} from '../../../../features/state';
import {
  BattleRecord,
  ShipSnapshot,
  SlotItemSnapshot,
  BattleSegment,
  BattleHpSnapshot,
  FleetRef,
} from '../../../../domain/models';

// ==================== 我方舰娘：快照 → ShipItem ====================

/**
 * ShipRow 需要的 ShipItem 比快照丰富（装备类型 / 图标需由 master id 解析）。
 * 历史快照缺省的字段（射程 / 经验 / 能力 tag）按惰性默认值填充，不影响主要展示。
 */
export function shipItemFromSnapshot(s: ShipSnapshot): ShipItem {
  const slotSnaps: (SlotItemSnapshot | null)[] = s.slots ?? [];
  const onslot: number[] = s.onslot ?? [];

  const slots: number[] = [];
  const slotMasterIds: number[] = [];
  const slotTypes: number[] = [];
  const slotIconTypes: number[] = [];
  const slotAirs: number[] = [];
  const slotLevels: number[] = [];
  const slotAlvs: number[] = [];

  for (let i = 0; i < slotSnaps.length; i++) {
    const it = slotSnaps[i];
    const air = i < onslot.length ? onslot[i] : 0;
    if (it && it.masterId > 0) {
      slots.push(it.uid > 0 ? it.uid : -1);
      slotMasterIds.push(it.masterId);
      slotTypes.push(getSlotItemMasterEquipType(it.masterId));
      slotIconTypes.push(getSlotItemMasterIconType(it.masterId));
      slotLevels.push(it.level ?? 0);
      slotAlvs.push(it.alv ?? 0);
      slotAirs.push(air);
    } else {
      slots.push(-1);
      slotMasterIds.push(0);
      slotTypes.push(0);
      slotIconTypes.push(0);
      slotLevels.push(0);
      slotAlvs.push(0);
      slotAirs.push(air);
    }
  }

  let exSlot = 0;
  let exSlotMasterId = 0;
  let exSlotType = 0;
  let exSlotIconType = 0;
  let exSlotLevel = 0;
  let exSlotAlv = 0;
  const ex = s.slotEx;
  if (ex && ex.masterId > 0) {
    exSlot = ex.uid > 0 ? ex.uid : -1;
    exSlotMasterId = ex.masterId;
    exSlotType = getSlotItemMasterEquipType(ex.masterId);
    exSlotIconType = getSlotItemMasterIconType(ex.masterId);
    exSlotLevel = ex.level ?? 0;
    exSlotAlv = ex.alv ?? 0;
  }

  return {
    id: s.uid,
    masterId: s.masterId,
    name: s.name,
    shipType: '',
    level: s.level,
    expToNext: 0,
    tags: [],
    hp: s.hpNow,
    hpMax: s.hpMax,
    s1: s.cond,
    s2: s.fuel,
    s3: s.ammo,
    s4: 0,
    range: 0,
    fuelMax: s.fuelMax,
    ammoMax: s.ammoMax,
    slots,
    slotMasterIds,
    slotTypes,
    slotIconTypes,
    slotAirs,
    slotLevels,
    slotAlvs,
    exSlot,
    exSlotMasterId,
    exSlotType,
    exSlotIconType,
    exSlotLevel,
    exSlotAlv,
  };
}

export function fleetShipItems(record: BattleRecord, escort: boolean): ShipItem[] {
  const fleet = escort ? record.friendFleetEscort : record.friendFleet;
  const ships = fleet?.ships ?? [];
  return ships.map(shipItemFromSnapshot);
}

// ==================== 敌方舰队 ====================

export interface EnemyShipView {
  idx: number;
  name: string;
  level: number;
  hpStart: number;
  hpEnd: number;
  hpMax: number;
}

function enemyShipViews(
  shipIds: number[],
  levels: number[],
  startNow: number[],
  startMax: number[],
  endNow: number[],
): EnemyShipView[] {
  const out: EnemyShipView[] = [];
  for (let i = 0; i < shipIds.length; i++) {
    const masterId = shipIds[i] ?? 0;
    const max = startMax[i] ?? startNow[i] ?? 0;
    if (max <= 0) continue;
    const nm = getShipMasterName(masterId);
    out.push({
      idx: i,
      name: nm && nm.length > 0 ? nm : `敌${i + 1}`,
      level: levels[i] ?? 0,
      hpStart: startNow[i] ?? max,
      hpEnd: Math.max(0, endNow[i] ?? max),
      hpMax: max,
    });
  }
  return out;
}

/** 敌方主队（用 segment 的 start/end HP 填充初/末血量；无 segment 时退回记录概要）。 */
export function enemyMainViews(record: BattleRecord): EnemyShipView[] {
  const seg = record.segment;
  const startNow = seg?.start.enemy.main.now ?? record.enemyFleet.hpNow ?? [];
  const startMax = seg?.start.enemy.main.max ?? record.enemyFleet.hpMax ?? [];
  const endNow = seg?.end.enemy.main.now ?? record.hpEnd?.enemy?.main?.now ?? startNow;
  return enemyShipViews(record.enemyFleet.shipIds, record.enemyFleet.levels, startNow, startMax, endNow);
}

export function enemyEscortViews(record: BattleRecord): EnemyShipView[] {
  const esc = record.enemyFleetEscort;
  if (!esc) return [];
  const seg = record.segment;
  const startNow = seg?.start.enemy.escort?.now ?? esc.hpNow ?? [];
  const startMax = seg?.start.enemy.escort?.max ?? esc.hpMax ?? [];
  const endNow = seg?.end.enemy.escort?.now ?? startNow;
  return enemyShipViews(esc.shipIds, esc.levels, startNow, startMax, endNow);
}

// ==================== 阶段标签 ====================

export function phaseLabel(kind: string): string {
  switch (kind) {
    case 'airBase': return '基地航空队';
    case 'air': return '航空战';
    case 'supportAir': return '航空支援';
    case 'supportShelling': return '炮击支援';
    case 'openingASW': return '开幕对潜';
    case 'openingTorpedo': return '开幕雷击';
    case 'shelling1': return '炮击战 ①';
    case 'shelling2': return '炮击战 ②';
    case 'shelling3': return '炮击战 ③';
    case 'torpedo': return '雷击战';
    case 'nightShelling': return '夜战';
    case 'nightTorpedo': return '夜战雷击';
    default: return kind;
  }
}

// ==================== 交战步骤回放 ====================

export type StepSide = 'friend' | 'enemy';

export interface EngagementStep {
  key: string;
  phaseSeq: number;
  phaseLabel: string;
  /** 该阶段的首条 → 渲染阶段分组标题。 */
  phaseHead: boolean;
  attackerName: string;     // 攻击方舰名（航空等无单一攻击者时为空）
  attackerSide: StepSide;
  attackerHpAfter: number;
  attackerHpMax: number;
  hasAttackerHp: boolean;
  targetName: string;
  targetSide: StepSide;
  damage: number;
  critical: number;         // 0 miss / 1 命中 / 2 暴击
  hpAfter: number;
  hpMax: number;
  sunk: boolean;
}

interface MutableHp {
  friendMain: number[];
  friendEscort: number[];
  enemyMain: number[];
  enemyEscort: number[];
}

interface FleetNames {
  main: string[];
  escort: string[];
}

function cloneArr(a: number[] | undefined): number[] {
  return a ? a.slice() : [];
}

function buildMutableHp(start: BattleHpSnapshot): MutableHp {
  return {
    friendMain: cloneArr(start.friend.main.now),
    friendEscort: cloneArr(start.friend.escort?.now),
    enemyMain: cloneArr(start.enemy.main.now),
    enemyEscort: cloneArr(start.enemy.escort?.now),
  };
}

function hpArrayFor(hp: MutableHp, ref: FleetRef): number[] {
  if (ref.side === 'friend') return ref.fleet === 'escort' ? hp.friendEscort : hp.friendMain;
  return ref.fleet === 'escort' ? hp.enemyEscort : hp.enemyMain;
}

function maxHpFor(start: BattleHpSnapshot, ref: FleetRef): number {
  const fleet = ref.side === 'friend'
    ? (ref.fleet === 'escort' ? start.friend.escort : start.friend.main)
    : (ref.fleet === 'escort' ? start.enemy.escort : start.enemy.main);
  const arr = fleet?.max ?? [];
  return arr[ref.idx] ?? 0;
}

function hpNowFor(hp: MutableHp, ref: FleetRef): number {
  const arr = hpArrayFor(hp, ref);
  if (ref.idx < 0 || ref.idx >= arr.length) return 0;
  return Math.max(0, arr[ref.idx] ?? 0);
}

function refName(ref: FleetRef, friend: FleetNames, enemy: FleetNames): string {
  const names = ref.side === 'friend' ? friend : enemy;
  const arr = ref.fleet === 'escort' ? names.escort : names.main;
  const nm = ref.idx >= 0 && ref.idx < arr.length ? arr[ref.idx] : '';
  if (nm && nm.length > 0) return nm;
  return `${ref.side === 'friend' ? '友' : '敌'}${ref.idx + 1}`;
}

function clampDmg(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.floor(x);
}

function friendNames(record: BattleRecord): FleetNames {
  return {
    main: (record.friendFleet?.ships ?? []).map((s) => s.name),
    escort: (record.friendFleetEscort?.ships ?? []).map((s) => s.name),
  };
}

function enemyNames(record: BattleRecord): FleetNames {
  const toNames = (ids: number[] | undefined): string[] => (ids ?? []).map((id) => {
    const nm = getShipMasterName(id);
    return nm && nm.length > 0 ? nm : '';
  });
  return {
    main: toNames(record.enemyFleet?.shipIds),
    escort: toNames(record.enemyFleetEscort?.shipIds),
  };
}

function fallbackAttackerName(phaseKind: string, side: StepSide): string {
  switch (phaseKind) {
    case 'airBase':
    case 'air':
    case 'supportAir':
      return '';
    case 'supportShelling':
      return side === 'friend' ? '支援舰队' : '敌支援';
    case 'openingTorpedo':
    case 'torpedo':
    case 'nightTorpedo':
      return side === 'friend' ? '我方雷击' : '敌方雷击';
    default:
      return side === 'friend' ? '我方' : '敌方';
  }
}

/**
 * 逐次回放：clone start HP，按 phase → event → hit 顺序扣血，
 * 每次命中产出一条 step（含命中后目标血量）。
 */
export function buildEngagementSteps(record: BattleRecord): EngagementStep[] {
  const seg: BattleSegment | undefined = record.segment;
  if (!seg) return [];

  const hp = buildMutableHp(seg.start);
  const friend = friendNames(record);
  const enemy = enemyNames(record);
  const steps: EngagementStep[] = [];

  for (const phase of seg.phases) {
    let headEmitted = false;
    const label = phaseLabel(phase.kind);
    for (const ev of phase.events) {
      const explicitAttacker = ev.attacker;
      for (const hit of ev.hits) {
        const t = hit.target;
        const arr = hpArrayFor(hp, t);
        if (t.idx < 0 || t.idx >= arr.length) continue;
        const dmg = clampDmg(hit.damage);
        const before = arr[t.idx] ?? 0;

        const attackerSide: StepSide = explicitAttacker
          ? explicitAttacker.side
          : (ev.attackerSide ?? (t.side === 'friend' ? 'enemy' : 'friend'));
        const attackerName = explicitAttacker
          ? refName(explicitAttacker, friend, enemy)
          : fallbackAttackerName(phase.kind, attackerSide);
        const attackerHpMax = explicitAttacker ? maxHpFor(seg.start, explicitAttacker) : 0;
        const attackerHpAfter = explicitAttacker ? hpNowFor(hp, explicitAttacker) : 0;

        const after = Math.max(0, before - dmg);
        arr[t.idx] = after;

        const max = maxHpFor(seg.start, t);
        steps.push({
          key: `p${phase.seq}-${steps.length}`,
          phaseSeq: phase.seq,
          phaseLabel: label,
          phaseHead: !headEmitted,
          attackerName,
          attackerSide,
          attackerHpAfter,
          attackerHpMax,
          hasAttackerHp: !!explicitAttacker && attackerHpMax > 0,
          targetName: refName(t, friend, enemy),
          targetSide: t.side,
          damage: dmg,
          critical: hit.critical ?? 0,
          hpAfter: after,
          hpMax: max,
          sunk: max > 0 && after <= 0,
        });
        headEmitted = true;
      }
    }
  }

  return steps;
}

// ==================== 阶段概要 ====================

export interface PhaseSummary {
  key: string;
  label: string;
  attacks: number;
  enemyDamage: number;   // 我方对敌方造成
  friendDamage: number;  // 敌方对我方造成
}

export function buildPhaseSummaries(record: BattleRecord): PhaseSummary[] {
  const seg = record.segment;
  if (!seg) return [];
  const out: PhaseSummary[] = [];
  for (const phase of seg.phases) {
    let attacks = 0;
    let enemyDamage = 0;
    let friendDamage = 0;
    for (const ev of phase.events) {
      if (ev.hits.length > 0) attacks++;
      for (const hit of ev.hits) {
        const d = clampDmg(hit.damage);
        if (hit.target.side === 'enemy') enemyDamage += d;
        else friendDamage += d;
      }
    }
    out.push({
      key: `sum-${phase.seq}`,
      label: phaseLabel(phase.kind),
      attacks,
      enemyDamage,
      friendDamage,
    });
  }
  return out;
}

// ==================== 列表行格式化 ====================

const AREA_NAMES: Map<number, string> = new Map<number, string>([
  [1, '镇守府海域'],
  [2, '南西诸岛海域'],
  [3, '北方海域'],
  [4, '西方海域'],
  [5, '南方海域'],
  [6, '中部海域'],
  [7, '南西海域'],
]);

export function mapCode(mapAreaId: number, mapInfoNo: number): string {
  return `${mapAreaId}-${mapInfoNo}`;
}

export function areaName(mapAreaId: number): string {
  const n = AREA_NAMES.get(mapAreaId);
  if (n) return n;
  return mapAreaId >= 10 || mapAreaId <= 0 ? '活动海域' : `第${mapAreaId}海域`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** MM/DD HH:mm（本地时区）。 */
export function formatMmDdHhMm(ts: number): string {
  if (!ts) return '--/-- --:--';
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 地图点位文本：boss 点用括号标注。 */
export function cellLabel(cellId: number, isBoss: boolean): string {
  return isBoss ? `${cellId}（Boss）` : `${cellId}`;
}

export function rankColor(rank: string): string {
  if (displayRank(rank) === 'S') return '#FFD700';
  if (rank === 'A') return '#ffdd1212';
  if (rank === 'B') return '#ffcb6d22';
  if (rank === 'C') return '#ff917c25';
  if (rank === 'D') return '#ff198311';
  return '#e53935';
}

export function displayRank(rank: string): string {
  return rank === 'SS' ? 'S' : rank;
}

function hpUnchanged(start: number[] | undefined, end: number[] | undefined): boolean {
  const a = start ?? [];
  const b = end ?? [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const before = a[i] ?? 0;
    const after = b[i] ?? before;
    if (after < before) return false;
  }
  return true;
}

export function isCompleteVictory(record: BattleRecord): boolean {
  if (displayRank(record.rank) !== 'S') return false;
  const start = record.hpStart?.friend;
  const end = record.hpEnd?.friend;
  if (!start || !end) return record.rank === 'SS';
  return hpUnchanged(start.main?.now, end.main?.now)
    && hpUnchanged(start.escort?.now, end.escort?.now);
}

export function battleResultLabel(rank: string, completeVictory: boolean = false): string {
  const r = displayRank(rank);
  switch (r) {
    case 'S': return `${completeVictory || rank === 'SS' ? '完全勝利' : '勝利'}S`;
    case 'A': return '勝利A';
    case 'B': return '戦術的勝利B';
    case 'C': return '戦術的敗北C';
    case 'D': return '敗北D';
    case 'E': return '敗北E';
    default: return r;
  }
}
