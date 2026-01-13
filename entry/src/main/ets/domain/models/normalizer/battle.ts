import {
  ApiAirBaseAttackRaw,
  ApiDayBattleDataRaw,
  ApiDestructionBattleRaw,
  ApiHougekiRaw,
  ApiKoukuRaw,
  ApiNightBattleDataRaw,
  ApiReqMapNextDataRaw,
  ApiStage3Raw,
  ApiSupportHouraiRaw,
  ApiSupportInfoRaw,
  ApiTorpedoRaw,
  BattleApiDataAny,
  BattleApiPath } from "../api/battle";
import { ApiMaybeEnvelope } from "../common";
import {
  BattleSegment,
  BattleFormation,
  BattleEnemyInfo,
  BattleHpSnapshot,
  BattlePhase,
  AttackEvent,
  DamageInstance,
  BattlePhaseKind,
  BattleSide,
  BattleHpFleet,
  FleetRef,
  BattleFleet
} from "../struct/battle";

export interface NormalizeBattleOptions {
  /** some callers pass only api_data; others pass full response */
  now?: number;
}

export function normalizeBattleSegment(apiPath: BattleApiPath, raw: ApiMaybeEnvelope<BattleApiDataAny>, opt: NormalizeBattleOptions = {}): BattleSegment | null {
  const now = opt.now ?? Date.now();
  const dataAny = unwrapApiData(raw);

  // special: api_req_map/next contains api_destruction_battle
  if (apiPath === 'api_req_map/next') {
    const next = dataAny as ApiReqMapNextDataRaw;
    if (!next?.api_destruction_battle) return null;
    return normalizeDestructionBattle('api_destruction_battle', next.api_destruction_battle, now);
  }

  if (apiPath === 'api_destruction_battle') {
    return normalizeDestructionBattle(apiPath, dataAny as ApiDestructionBattleRaw, now);
  }

  // Heuristic: night endpoints have api_hougeki at root and usually no day fields.
  if (isNightBattleData(dataAny)) {
    return normalizeNightBattle(apiPath, dataAny, now);
  }

  return normalizeDayBattle(apiPath, dataAny as ApiDayBattleDataRaw, now);
}

/** ---------- Envelope ---------- */

function unwrapApiData<T>(raw: ApiMaybeEnvelope<T>): T {
  if (raw && typeof raw === 'object' && 'api_data' in (raw as any)) return (raw as any).api_data as T;
  return raw as T;
}

/** ----------  guards ---------- */

function isNightBattleData(x: any): x is ApiNightBattleDataRaw {
  return !!x && typeof x === 'object' && !!x.api_hougeki && !!x.api_hougeki.api_damage;
}

/** ---------- Day / Night / Destruction ---------- */

function normalizeDayBattle(apiPath: string, d: ApiDayBattleDataRaw, now: number): BattleSegment {
  const meta = buildMeta(apiPath, d, now);
  const start = buildHpSnapshot(d);
  const enemy = buildEnemyInfo(d);

  const phases = extractDayPhases(d, start);
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemy, createdAt: now };
}


function normalizeNightBattle(apiPath: string, d: ApiNightBattleDataRaw, now: number): BattleSegment {
  const meta = buildMeta(apiPath, d, now);
  const start = buildHpSnapshot(d);
  const enemy = buildEnemyInfo(d);

  const phases = extractNightPhases(d, start);
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemy, createdAt: now };
}

function normalizeDestructionBattle(apiPath: string, d: ApiDestructionBattleRaw, now: number): BattleSegment {
  const meta = buildMeta(apiPath, d, now);
  const start = buildHpSnapshot(d);
  const enemy = buildEnemyInfo(d);

  // treat it like a day battle subset
  const phases = extractDestructionPhases(d, start);
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemy, createdAt: now };
}

/** ---------- Meta / Snapshot ---------- */

function buildMeta(apiPath: string, d: any, now: number) {
  const formation = parseFormation(d?.api_formation);
  const meta = {
    apiPath,
    deckId: typeof d?.api_deck_id === 'number' ? d.api_deck_id : undefined,
    formation,
    midnightFlag: typeof d?.api_midnight_flag === 'number' ? d.api_midnight_flag : undefined,
    search: Array.isArray(d?.api_search) ? d.api_search : undefined,
    stageFlag: Array.isArray(d?.api_stage_flag) ? d.api_stage_flag : undefined,
    smokeType: typeof d?.api_smoke_type === 'number' ? d.api_smoke_type : undefined,
    balloonCell: typeof d?.api_balloon_cell === 'number' ? d.api_balloon_cell : undefined,
    atollCell: typeof d?.api_atoll_cell === 'number' ? d.api_atoll_cell : undefined,
  };
  return meta;
}

function parseFormation(arr?: number[]): BattleFormation | undefined {
  if (!Array.isArray(arr) || arr.length < 3) return undefined;
  return { friend: arr[0], enemy: arr[1], engagement: arr[2] };
}

function buildEnemyInfo(d: any): BattleEnemyInfo | undefined {
  const mainKe = toNumArray(d?.api_ship_ke);
  const mainLv = toNumArray(d?.api_ship_lv);
  const escortKe = toNumArray(d?.api_ship_ke_combined);
  const escortLv = toNumArray(d?.api_ship_lv_combined);
  if (!mainKe && !escortKe) return undefined;
  return { mainKe: mainKe ?? undefined, mainLv: mainLv ?? undefined, escortKe: escortKe ?? undefined, escortLv: escortLv ?? undefined };
}

function buildHpSnapshot(d: any): BattleHpSnapshot {
  const friendMainNow = normalizeHpArray(d?.api_f_nowhps);
  const friendMainMax = normalizeHpArray(d?.api_f_maxhps);
  const friendEscortNow = normalizeHpArray(d?.api_f_nowhps_combined);
  const friendEscortMax = normalizeHpArray(d?.api_f_maxhps_combined);

  const enemyMainNow = normalizeHpArray(d?.api_e_nowhps);
  const enemyMainMax = normalizeHpArray(d?.api_e_maxhps);
  const enemyEscortNow = normalizeHpArray(d?.api_e_nowhps_combined);
  const enemyEscortMax = normalizeHpArray(d?.api_e_maxhps_combined);

  const snap: BattleHpSnapshot = {
    friend: {
      main: { now: friendMainNow, max: friendMainMax.length ? friendMainMax : friendMainNow.map(() => 0) },
      escort: friendEscortNow.length || friendEscortMax.length ? { now: friendEscortNow, max: friendEscortMax.length ? friendEscortMax : friendEscortNow.map(() => 0) } : undefined,
    },
    enemy: {
      main: { now: enemyMainNow, max: enemyMainMax.length ? enemyMainMax : enemyMainNow.map(() => 0) },
      escort: enemyEscortNow.length || enemyEscortMax.length ? { now: enemyEscortNow, max: enemyEscortMax.length ? enemyEscortMax : enemyEscortNow.map(() => 0) } : undefined,
    },
  };
  return snap;
}

/** If array has dummy head (0/-1/null) and length looks like 7/13, strip it */
function normalizeHpArray(arr?: Array<number | null> | null): number[] {
  if (!Array.isArray(arr)) return [];
  const nums = arr.map((v) => (typeof v === 'number' ? v : 0));
  if (nums.length === 7 && (nums[0] === 0 || nums[0] === -1)) return nums.slice(1);
  if (nums.length === 13 && (nums[0] === 0 || nums[0] === -1)) return nums.slice(1);
  return nums;
}

function toNumArray(arr?: Array<number | null> | null): number[] | null {
  if (!Array.isArray(arr)) return null;
  const xs = arr.map((v) => (typeof v === 'number' ? v : 0));
  // many enemy arrays also have dummy head
  if (xs.length === 7 && (xs[0] === 0 || xs[0] === -1)) return xs.slice(1);
  if (xs.length === 13 && (xs[0] === 0 || xs[0] === -1)) return xs.slice(1);
  return xs;
}
/** ---------- Phase extraction ---------- */

function extractDayPhases(d: ApiDayBattleDataRaw, start: BattleHpSnapshot): BattlePhase[] {
  const phases: BattlePhase[] = [];
  let seq = 1;

  // Optional: night-to-day style endpoints embed night phases as api_n_*
  if (d.api_n_hougeki1) phases.push(mkHougekiPhase('nightShelling', seq++, 'api_n_hougeki1', d.api_n_hougeki1, start));
  if (d.api_n_hougeki2) phases.push(mkHougekiPhase('nightShelling', seq++, 'api_n_hougeki2', d.api_n_hougeki2, start));
  if (d.api_n_hougeki3) phases.push(mkHougekiPhase('nightShelling', seq++, 'api_n_hougeki3', d.api_n_hougeki3, start));
  if (d.api_n_raigeki) phases.push(mkTorpedoPhase('nightTorpedo', seq++, 'api_n_raigeki', d.api_n_raigeki, start));

  // Land base air
  if (Array.isArray(d.api_air_base_attack)) {
    for (let i = 0; i < d.api_air_base_attack.length; i++) {
      phases.push(mkAirBasePhase(seq++, `api_air_base_attack[${i}]`, d.api_air_base_attack[i], start));
    }
  }

  // Air battle
  if (d.api_kouku) phases.push(mkKoukuPhase(seq++, 'api_kouku', d.api_kouku, start));
  if ((d as any).api_kouku2) phases.push(mkKoukuPhase(seq++, 'api_kouku2', (d as any).api_kouku2, start));

  // Support
  if (d.api_support_flag && d.api_support_info) {
    const sup = d.api_support_info as ApiSupportInfoRaw;
    const p = mkSupportPhase(seq++, 'api_support_info', sup, start);
    if (p) phases.push(p);
  }

  // Opening ASW
  if (d.api_opening_taisen_flag && d.api_opening_taisen) {
    phases.push(mkHougekiPhase('openingASW', seq++, 'api_opening_taisen', d.api_opening_taisen, start));
  }

  // Opening torpedo
  if (d.api_opening_flag && d.api_opening_atack) {
    phases.push(mkTorpedoPhase('openingTorpedo', seq++, 'api_opening_atack', d.api_opening_atack, start));
  }
  if ((d as any).api_opening_flag2 && (d as any).api_opening_atack2) {
    phases.push(mkTorpedoPhase('openingTorpedo', seq++, 'api_opening_atack2', (d as any).api_opening_atack2, start));
  }

  // Shelling
  if (d.api_hougeki1) phases.push(mkHougekiPhase('shelling1', seq++, 'api_hougeki1', d.api_hougeki1, start));
  if (d.api_hougeki2) phases.push(mkHougekiPhase('shelling2', seq++, 'api_hougeki2', d.api_hougeki2, start));
  if (d.api_hougeki3) phases.push(mkHougekiPhase('shelling3', seq++, 'api_hougeki3', d.api_hougeki3, start));

  // Torpedo
  if (d.api_raigeki) phases.push(mkTorpedoPhase('torpedo', seq++, 'api_raigeki', d.api_raigeki, start));

  return phases;
}

function extractNightPhases(d: ApiNightBattleDataRaw, start: BattleHpSnapshot): BattlePhase[] {
  const phases: BattlePhase[] = [];
  let seq = 1;
  phases.push(mkHougekiPhase('nightShelling', seq++, 'api_hougeki', d.api_hougeki, start));
  return phases;
}

function extractDestructionPhases(d: ApiDestructionBattleRaw, start: BattleHpSnapshot): BattlePhase[] {
  const phases: BattlePhase[] = [];
  let seq = 1;

  if (Array.isArray(d.api_air_base_attack)) {
    for (let i = 0; i < d.api_air_base_attack.length; i++) {
      phases.push(mkAirBasePhase(seq++, `api_air_base_attack[${i}]`, d.api_air_base_attack[i], start));
    }
  }

  if (d.api_kouku) phases.push(mkKoukuPhase(seq++, 'api_kouku', d.api_kouku, start));

  if (d.api_support_flag && d.api_support_info) {
    const p = mkSupportPhase(seq++, 'api_support_info', d.api_support_info, start);
    if (p) phases.push(p);
  }

  if (d.api_opening_taisen_flag && d.api_opening_taisen) {
    phases.push(mkHougekiPhase('openingASW', seq++, 'api_opening_taisen', d.api_opening_taisen, start));
  }
  if (d.api_hougeki1) phases.push(mkHougekiPhase('shelling1', seq++, 'api_hougeki1', d.api_hougeki1, start));
  if (d.api_hougeki2) phases.push(mkHougekiPhase('shelling2', seq++, 'api_hougeki2', d.api_hougeki2, start));
  if (d.api_hougeki3) phases.push(mkHougekiPhase('shelling3', seq++, 'api_hougeki3', d.api_hougeki3, start));
  if (d.api_raigeki) phases.push(mkTorpedoPhase('torpedo', seq++, 'api_raigeki', d.api_raigeki, start));

  return phases;
}
/** ---------- Phase builders ---------- */

function mkAirBasePhase(seq: number, key: string, raw: ApiAirBaseAttackRaw, start: BattleHpSnapshot): BattlePhase {
  const events: AttackEvent[] = [];

  // stage3 (main)
  pushStage3DamageEvents(events, raw.api_stage3, start, /*friendDam=*/false, /*enemyDam=*/true, 'enemy', 'main');

  // stage3_combined (escort side)
  pushStage3DamageEvents(events, raw.api_stage3_combined, start, false, true, 'enemy', 'escort');

  return { kind: 'airBase', seq, rawKey: key, events };
}

function mkKoukuPhase(seq: number, key: string, raw: ApiKoukuRaw, start: BattleHpSnapshot): BattlePhase {
  const events: AttackEvent[] = [];

  // stage3 (main)
  pushStage3DamageEvents(events, raw.api_stage3, start, true, true, 'both', 'main');

  // stage3_combined (escort)
  pushStage3DamageEvents(events, raw.api_stage3_combined, start, true, true, 'both', 'escort');

  return { kind: 'air', seq, rawKey: key, events };
}

function mkSupportPhase(seq: number, key: string, raw: ApiSupportInfoRaw | null, start: BattleHpSnapshot): BattlePhase | null {
  if (!raw) return null;

  if (raw.api_support_airatack) {
    const events: AttackEvent[] = [];
    const s3 = raw.api_support_airatack.api_stage3;
    // support air: damage typically applied to enemy; but keep both in case
    pushStage3DamageEvents(events, s3, start, false, true, 'enemy', 'main');
    pushStage3DamageEvents(events, raw.api_support_airatack.api_stage3_combined, start, false, true, 'enemy', 'escort');
    return { kind: 'supportAir', seq, rawKey: key, events };
  }

  if (raw.api_support_hourai) {
    return mkSupportHouraiPhase(seq, key, raw.api_support_hourai, start);
  }

  return null;
}

function mkSupportHouraiPhase(seq: number, key: string, raw: ApiSupportHouraiRaw, start: BattleHpSnapshot): BattlePhase {
  const events: AttackEvent[] = [];

  // api_damage is aligned to enemy slots; apply to enemy main/escort sequentially.
  const dmg = normalizeHpArray(raw.api_damage);
  const hits: DamageInstance[] = [];

  // split by enemy fleet sizes if escort exists and dmg is long enough
  const eMainLen = start.enemy.main.now.length;
  const eEscLen = start.enemy.escort?.now.length ?? 0;

  const mainPart = dmg.slice(0, eMainLen);
  for (let i = 0; i < mainPart.length; i++) {
    const val = clampDmg(mainPart[i]);
    if (val <= 0) continue;
    hits.push({ target: { side: 'enemy', fleet: 'main', idx: i }, damage: val });
  }

  if (eEscLen) {
    const escPart = dmg.slice(eMainLen, eMainLen + eEscLen);
    for (let i = 0; i < escPart.length; i++) {
      const val = clampDmg(escPart[i]);
      if (val <= 0) continue;
      hits.push({ target: { side: 'enemy', fleet: 'escort', idx: i }, damage: val });
    }
  }

  if (hits.length) events.push({ attackerSide: 'friend', hits });

  return { kind: 'supportShelling', seq, rawKey: key, events };
}

function mkHougekiPhase(kind: BattlePhaseKind, seq: number, key: string, raw: ApiHougekiRaw, start: BattleHpSnapshot): BattlePhase {
  const events: AttackEvent[] = [];
  const atE = Array.isArray(raw.api_at_eflag) ? raw.api_at_eflag : [];
  const atList = Array.isArray(raw.api_at_list) ? raw.api_at_list : [];
  const atType = Array.isArray(raw.api_at_type) ? raw.api_at_type : [];
  const dfList = Array.isArray(raw.api_df_list) ? raw.api_df_list : [];
  const dmgList = Array.isArray(raw.api_damage) ? raw.api_damage : [];
  const clList = Array.isArray(raw.api_cl_list) ? raw.api_cl_list : [];

  const n = Math.max(atE.length, atList.length, dfList.length, dmgList.length);

  for (let i = 0; i < n; i++) {
    const attackerIsEnemy = (atE[i] ?? 0) === 1;
    const attackerSide: BattleSide = attackerIsEnemy ? 'enemy' : 'friend';
    const defenderSide: BattleSide = attackerIsEnemy ? 'friend' : 'enemy';

    const attackerIdx1 = atList[i] ?? 0;
    const attackerRef = resolveIndexToFleetRef(attackerSide, attackerIdx1, start);

    const df = dfList[i] ?? [];
    const dmg = dmgList[i] ?? [];
    const cl = clList[i] ?? [];

    const hits: DamageInstance[] = [];
    for (let j = 0; j < df.length; j++) {
      const tIdx1 = df[j] ?? 0;
      const tRef = resolveIndexToFleetRef(defenderSide, tIdx1, start);
      if (!tRef) continue;

      const dval = clampDmg(dmg[j] ?? 0);
      if (dval <= 0) continue;

      hits.push({ target: tRef, damage: dval, critical: typeof cl[j] === 'number' ? (cl[j] as number) : undefined });
    }

    if (hits.length) {
      events.push({
        attacker: attackerRef ?? undefined,
        attackerSide,
        attackerRawIndex: attackerIdx1,
        attackType: typeof atType[i] === 'number' ? atType[i] : undefined,
        hits,
      });
    }
  }

  return { kind, seq, rawKey: key, events };
}

function mkTorpedoPhase(kind: BattlePhaseKind, seq: number, key: string, raw: ApiTorpedoRaw, start: BattleHpSnapshot): BattlePhase {
  const events: AttackEvent[] = [];

  // Interpret as damage arrays directly (most robust):
  // - api_fdam: damage to friend main
  // - api_fydam: damage to friend escort
  // - api_edam: damage to enemy main
  // - api_eydam: damage to enemy escort
  const hits: DamageInstance[] = [];

  pushDamageArrayToFleet(hits, 'friend', 'main', raw.api_fdam, start);
  if (raw.api_fydam) pushDamageArrayToFleet(hits, 'friend', 'escort', raw.api_fydam, start);

  pushDamageArrayToFleet(hits, 'enemy', 'main', raw.api_edam, start);
  if (raw.api_eydam) pushDamageArrayToFleet(hits, 'enemy', 'escort', raw.api_eydam, start);

  if (hits.length) events.push({ hits });

  return { kind, seq, rawKey: key, events };
}

/** ---------- Damage application ---------- */

function applyPhases(start: BattleHpSnapshot, phases: BattlePhase[]): BattleHpSnapshot {
  const end: BattleHpSnapshot = deepCloneHp(start);

  for (const p of phases) {
    for (const e of p.events) {
      for (const h of e.hits) {
        const { side, fleet, idx } = h.target;
        const dmg = clampDmg(h.damage);
        if (dmg <= 0) continue;

        const targetFleet = side === 'friend'
          ? fleet === 'main' ? end.friend.main : end.friend.escort
          : fleet === 'main' ? end.enemy.main : end.enemy.escort;

        if (!targetFleet) continue;
        if (idx < 0 || idx >= targetFleet.now.length) continue;

        targetFleet.now[idx] = Math.max(0, (targetFleet.now[idx] ?? 0) - dmg);
      }
    }
  }

  return end;
}

function deepCloneHp(s: BattleHpSnapshot): BattleHpSnapshot {
  const cloneFleet = (f: BattleHpFleet): BattleHpFleet => ({
    now: [...(f.now ?? [])],
    max: [...(f.max ?? [])],
  });

  return {
    friend: {
      main: cloneFleet(s.friend.main),
      escort: s.friend.escort ? cloneFleet(s.friend.escort) : undefined,
    },
    enemy: {
      main: cloneFleet(s.enemy.main),
      escort: s.enemy.escort ? cloneFleet(s.enemy.escort) : undefined,
    },
  };
}
/** ---------- Helpers: mapping indices to fleets ---------- */

/**
 * Kancolle indices are 1-based.
 * For combined situations:
 * - 1..mainLen => main
 * - mainLen+1..mainLen+escortLen => escort
 */
function resolveIndexToFleetRef(side: BattleSide, idx1: number, snap: BattleHpSnapshot): FleetRef | null {
  if (!idx1 || idx1 <= 0) return null;
  const idx0 = idx1 - 1;

  const mainLen = side === 'friend' ? snap.friend.main.now.length : snap.enemy.main.now.length;
  const escLen = side === 'friend' ? (snap.friend.escort?.now.length ?? 0) : (snap.enemy.escort?.now.length ?? 0);

  if (idx0 < mainLen) return { side, fleet: 'main', idx: idx0 };
  if (escLen && idx0 < mainLen + escLen) return { side, fleet: 'escort', idx: idx0 - mainLen };

  // out of range (e.g., dummy slot)
  return null;
}

function pushDamageArrayToFleet(
  hits: DamageInstance[],
  side: BattleSide,
  fleet: BattleFleet,
  rawArr: Array<number | null> | null | undefined,
  snap: BattleHpSnapshot
) {
  const arr = normalizeHpArray(rawArr);
  const target = side === 'friend'
    ? (fleet === 'main' ? snap.friend.main : snap.friend.escort)
    : (fleet === 'main' ? snap.enemy.main : snap.enemy.escort);

  if (!target) return;

  const len = Math.min(arr.length, target.now.length);
  for (let i = 0; i < len; i++) {
    const dmg = clampDmg(arr[i]);
    if (dmg <= 0) continue;
    hits.push({ target: { side, fleet, idx: i }, damage: dmg });
  }
}

/**
 * Push events based on stage3 object.
 * mode:
 * - who = 'enemy' => only apply edam
 * - who = 'both'  => apply both fdam & edam
 * fleetHint:
 * - 'main' or 'escort' decides which fleet should receive fdam/edam if "combined" stage is used.
 */
function pushStage3DamageEvents(
  events: AttackEvent[],
  s3: ApiStage3Raw | null | undefined,
  snap: BattleHpSnapshot,
  friendDam: boolean,
  enemyDam: boolean,
  who: 'enemy' | 'both',
  fleetHint: 'main' | 'escort'
) {
  if (!s3) return;

  const hits: DamageInstance[] = [];

  if (enemyDam && (who === 'enemy' || who === 'both') && Array.isArray(s3.api_edam)) {
    // apply to enemy fleetHint if exists else main
    const useFleet: BattleFleet = (fleetHint === 'escort' && snap.enemy.escort) ? 'escort' : 'main';
    pushDamageArrayToFleet(hits, 'enemy', useFleet, s3.api_edam, snap);
  }

  if (friendDam && who === 'both' && Array.isArray(s3.api_fdam)) {
    const useFleet: BattleFleet = (fleetHint === 'escort' && snap.friend.escort) ? 'escort' : 'main';
    pushDamageArrayToFleet(hits, 'friend', useFleet, s3.api_fdam ?? [], snap);
  }

  if (hits.length) events.push({ hits });
}

function clampDmg(x: any): number {
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  return Math.floor(n);
}
