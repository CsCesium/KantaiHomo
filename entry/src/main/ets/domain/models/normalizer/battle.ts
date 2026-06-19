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
  EnemyFleetInfo,
  BattleHpSnapshot,
  BattlePhase,
  AttackEvent,
  DamageInstance,
  BattlePhaseKind,
  BattleSide,
  BattleHpFleet,
  FleetRef,
  BattleFleet,
  AerialStageInfo,
  AntiAirCutInInfo,
  AerialCombatInfo,
  LbasWaveInfo
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

  // 开幕夜战：单包内先夜战（root api_hougeki）后昼战（kouku/hougeki1..3 等）。
  // 必须同时提取两段 phase，否则 isNightBattleData 命中后会丢失昼战阶段。
  if (apiPath === 'api_req_combined_battle/ec_night_to_day') {
    return normalizeNightToDayBattle(apiPath, dataAny as ApiNightBattleDataRaw & ApiDayBattleDataRaw, now);
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
  const { enemyMain, enemyEscort } = buildEnemyInfo(d, start);

  const phases = extractDayPhases(d, start);
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemyMain, enemyEscort, createdAt: now };
}


function normalizeNightBattle(apiPath: string, d: ApiNightBattleDataRaw, now: number): BattleSegment {
  const meta = buildMeta(apiPath, d, now);
  const start = buildHpSnapshot(d);
  const { enemyMain, enemyEscort } = buildEnemyInfo(d, start);

  const phases = extractNightPhases(d, start);
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemyMain, enemyEscort, createdAt: now };
}

function normalizeNightToDayBattle(apiPath: string, d: ApiNightBattleDataRaw & ApiDayBattleDataRaw, now: number): BattleSegment {
  const meta = buildMeta(apiPath, d, now);
  const start = buildHpSnapshot(d);
  const { enemyMain, enemyEscort } = buildEnemyInfo(d, start);

  const nightPhases = extractNightPhases(d, start);
  const dayPhases = extractDayPhases(d, start);
  const phases = [...nightPhases, ...dayPhases].map((p, i) => ({ ...p, seq: i + 1 }));
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemyMain, enemyEscort, createdAt: now };
}

function normalizeDestructionBattle(apiPath: string, d: ApiDestructionBattleRaw, now: number): BattleSegment {
  const meta = buildMeta(apiPath, d, now);
  const start = buildHpSnapshot(d);
  const { enemyMain, enemyEscort } = buildEnemyInfo(d, start);

  // treat it like a day battle subset
  const phases = extractDestructionPhases(d, start);
  const end = applyPhases(start, phases);

  return { meta, start, phases, end, enemyMain, enemyEscort, createdAt: now };
}

/** ---------- Meta / Snapshot ---------- */

function buildMeta(apiPath: string, d: any, now: number) {
  const formation = parseFormation(d?.api_formation);

  // Extract air state and plane counts from kouku stage1 (may be kouku or kouku2 for combined)
  const stage1 = d?.api_kouku?.api_stage1 ?? d?.api_kouku2?.api_stage1;
  const airState: number | undefined = typeof stage1?.api_disp_seiku === 'number' ? stage1.api_disp_seiku : undefined;
  const friendPlaneMax: number | undefined = typeof stage1?.api_f_count === 'number' ? stage1.api_f_count : undefined;
  const friendPlaneLost: number | undefined = typeof stage1?.api_f_lostcount === 'number' ? stage1.api_f_lostcount : undefined;
  const friendPlaneNow: number | undefined = (friendPlaneMax !== undefined && friendPlaneLost !== undefined)
    ? Math.max(0, friendPlaneMax - friendPlaneLost)
    : undefined;
  const enemyPlaneMax: number | undefined = typeof stage1?.api_e_count === 'number' ? stage1.api_e_count : undefined;
  const enemyPlaneLost: number | undefined = typeof stage1?.api_e_lostcount === 'number' ? stage1.api_e_lostcount : undefined;
  const enemyPlaneNow: number | undefined = (enemyPlaneMax !== undefined && enemyPlaneLost !== undefined)
    ? Math.max(0, enemyPlaneMax - enemyPlaneLost)
    : undefined;

  const aerialPhases: AerialCombatInfo[] = [];
  const kouku1 = parseAerialCombat(d?.api_kouku);
  if (kouku1) aerialPhases.push(kouku1);
  const kouku2 = parseAerialCombat(d?.api_kouku2);
  if (kouku2) aerialPhases.push(kouku2);

  const meta = {
    apiPath,
    deckId: typeof d?.api_deck_id === 'number' ? d.api_deck_id : undefined,
    formation,
    midnightFlag: typeof d?.api_midnight_flag === 'number' ? d.api_midnight_flag : undefined,
    search: Array.isArray(d?.api_search) ? d.api_search : undefined,
    stageFlag: Array.isArray(d?.api_stage_flag) ? d.api_stage_flag : undefined,
    smokeType: typeof d?.api_smoke_type === 'number' ? d.api_smoke_type : undefined,
    airState,
    friendPlaneNow,
    friendPlaneMax,
    enemyPlaneNow,
    enemyPlaneMax,
    aerialPhases: aerialPhases.length ? aerialPhases : undefined,
    lbasWaves: parseLbasWaves(d?.api_air_base_attack),
    balloonCell: typeof d?.api_balloon_cell === 'number' ? d.api_balloon_cell : undefined,
    atollCell: typeof d?.api_atoll_cell === 'number' ? d.api_atoll_cell : undefined,
  };
  return meta;
}

/** ---------- Aerial combat info extraction ---------- */

function parseAerialStage(s: any): AerialStageInfo | undefined {
  if (!s || typeof s !== 'object') return undefined;
  if (typeof s.api_f_count !== 'number' && typeof s.api_e_count !== 'number') return undefined;
  return {
    friendCount: typeof s.api_f_count === 'number' ? s.api_f_count : 0,
    friendLost: typeof s.api_f_lostcount === 'number' ? s.api_f_lostcount : 0,
    enemyCount: typeof s.api_e_count === 'number' ? s.api_e_count : 0,
    enemyLost: typeof s.api_e_lostcount === 'number' ? s.api_e_lostcount : 0,
  };
}

/** api_touch_plane: [友方触接机图鉴ID, 敌方触接机图鉴ID]，<=0 表示未触接 */
function parseTouchPlane(arr: any): { friend?: number; enemy?: number } {
  if (!Array.isArray(arr)) return {};
  return {
    friend: typeof arr[0] === 'number' && arr[0] > 0 ? arr[0] : undefined,
    enemy: typeof arr[1] === 'number' && arr[1] > 0 ? arr[1] : undefined,
  };
}

function parseAirFire(s2: any): AntiAirCutInInfo | undefined {
  const fire = s2?.api_air_fire;
  if (!fire || typeof fire.api_kind !== 'number') return undefined;
  return {
    shipIdx: typeof fire.api_idx === 'number' ? fire.api_idx : -1,
    kind: fire.api_kind,
    useItemIds: Array.isArray(fire.api_use_items)
      ? fire.api_use_items.filter((x: any) => typeof x === 'number' && x > 0)
      : [],
  };
}

function parseAerialCombat(kouku: any): AerialCombatInfo | undefined {
  if (!kouku || typeof kouku !== 'object') return undefined;
  const stage1 = parseAerialStage(kouku.api_stage1);
  const stage2 = parseAerialStage(kouku.api_stage2);
  if (!stage1 && !stage2) return undefined;
  const touch = parseTouchPlane(kouku.api_stage1?.api_touch_plane);
  return {
    airState: typeof kouku.api_stage1?.api_disp_seiku === 'number' ? kouku.api_stage1.api_disp_seiku : undefined,
    stage1,
    stage2,
    touchFriend: touch.friend,
    touchEnemy: touch.enemy,
    airFire: parseAirFire(kouku.api_stage2),
  };
}

function parseLbasWaves(arr: any): LbasWaveInfo[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const waves: LbasWaveInfo[] = [];
  for (const w of arr) {
    if (!w || typeof w !== 'object') continue;
    const touch = parseTouchPlane(w.api_stage1?.api_touch_plane);
    waves.push({
      baseId: typeof w.api_base_id === 'number' ? w.api_base_id : 0,
      squadronCounts: Array.isArray(w.api_squadron_plane)
        ? w.api_squadron_plane.map((s: any) => (typeof s?.api_count === 'number' ? s.api_count : 0))
        : [],
      airState: typeof w.api_stage1?.api_disp_seiku === 'number' ? w.api_stage1.api_disp_seiku : undefined,
      stage1: parseAerialStage(w.api_stage1),
      stage2: parseAerialStage(w.api_stage2),
      touchFriend: touch.friend,
      touchEnemy: touch.enemy,
    });
  }
  return waves.length ? waves : undefined;
}

function parseFormation(arr?: number[]): BattleFormation | undefined {
  if (!Array.isArray(arr) || arr.length < 3) return undefined;
  return { friend: arr[0], enemy: arr[1], engagement: arr[2] };
}

function buildEnemyInfo(d: any, hpSnap: BattleHpSnapshot): { enemyMain?: EnemyFleetInfo; enemyEscort?: EnemyFleetInfo } {
  const mainKe   = toNumArray(d?.api_ship_ke);
  const mainLv   = toNumArray(d?.api_ship_lv);
  const escortKe = toNumArray(d?.api_ship_ke_combined);
  const escortLv = toNumArray(d?.api_ship_lv_combined);

  const enemyMain: EnemyFleetInfo | undefined = mainKe ? {
    shipIds: mainKe,
    levels:  mainLv ?? [],
    slots:   d?.api_eSlot   ?? undefined,
    params:  d?.api_eParam  ?? undefined,
    hpNow:   hpSnap.enemy.main.now,
    hpMax:   hpSnap.enemy.main.max,
  } : undefined;

  const enemyEscort: EnemyFleetInfo | undefined = escortKe ? {
    shipIds: escortKe,
    levels:  escortLv ?? [],
    slots:   d?.api_eSlot_combined  ?? undefined,
    params:  d?.api_eParam_combined ?? undefined,
    hpNow:   hpSnap.enemy.escort?.now ?? [],
    hpMax:   hpSnap.enemy.escort?.max ?? [],
  } : undefined;

  return { enemyMain, enemyEscort };
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

/**
 * 航空 / 支援等「受伤方数组」里，友方伤害数组按舰队下标 0-indexed 排列：
 * 第一艘舰娘的伤害在 index 0，长度通常为 6，也可能为 7（末尾补 0）。
 * 不能像 normalizeHpArray 那样在 length===7 && nums[0]===0 时去头，否则
 * 一号位「这一阶段没吃伤」(d1=0) 时会把 d1 当成 dummy 截掉，导致
 * 「n+1 号位伤害贴到 n 号位、一号位伤害消失」的错位。
 *
 * 敌方受伤数组（api_edam 等）跟 api_ship_ke 一样在 index 0 有 dummy，
 * 仍然走 normalizeHpArray。雷击阶段不使用这里的逻辑，雷击数组按攻击者索引排列。
 */
function toFriendDamageArray(arr?: Array<number | null> | null): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => (typeof v === 'number' ? v : 0));
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

  pushTorpedoEvents(
    events,
    'friend',
    'enemy',
    raw.api_frai,
    raw.api_fydam ?? raw.api_fdam,
    raw.api_fcl,
    start
  );
  pushTorpedoEvents(
    events,
    'enemy',
    'friend',
    raw.api_erai,
    raw.api_eydam ?? raw.api_edam,
    raw.api_ecl,
    start
  );

  if (events.length === 0) {
    pushTorpedoListItemEvents(
      events,
      'friend',
      'enemy',
      raw.api_frai_list_items,
      raw.api_fydam_list_items ?? raw.api_fdam_list_items,
      raw.api_fcl_list_items,
      start
    );
    pushTorpedoListItemEvents(
      events,
      'enemy',
      'friend',
      raw.api_erai_list_items,
      raw.api_eydam_list_items ?? raw.api_edam_list_items,
      raw.api_ecl_list_items,
      start
    );
  }

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

/**
 * Torpedo arrays use zero-based combined-fleet indices:
 * main fleet first, then escort fleet; -1 means no target.
 */
function resolveCombinedIndexToFleetRef(side: BattleSide, idx0: number, snap: BattleHpSnapshot): FleetRef | null {
  if (idx0 < 0) return null;

  const mainLen = side === 'friend' ? snap.friend.main.now.length : snap.enemy.main.now.length;
  const escLen = side === 'friend' ? (snap.friend.escort?.now.length ?? 0) : (snap.enemy.escort?.now.length ?? 0);

  if (idx0 < mainLen) return { side, fleet: 'main', idx: idx0 };
  if (escLen && idx0 < mainLen + escLen) return { side, fleet: 'escort', idx: idx0 - mainLen };

  return null;
}

function toTorpedoIndexArray(arr?: Array<number | null> | null): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => (typeof v === 'number' ? v : -1));
}

function toTorpedoDamageArray(arr?: Array<number | null> | null): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => (typeof v === 'number' ? v : 0));
}

function pushTorpedoEvents(
  events: AttackEvent[],
  attackerSide: BattleSide,
  targetSide: BattleSide,
  rawTargets: Array<number | null> | null | undefined,
  rawDamage: Array<number | null> | null | undefined,
  rawCritical: Array<number | null> | null | undefined,
  snap: BattleHpSnapshot
) {
  const targets = toTorpedoIndexArray(rawTargets);
  const damages = toTorpedoDamageArray(rawDamage);
  const criticals = toTorpedoIndexArray(rawCritical);
  const n = Math.max(targets.length, damages.length, criticals.length);

  for (let i = 0; i < n; i++) {
    const attackerRef = resolveCombinedIndexToFleetRef(attackerSide, i, snap);
    const targetRef = resolveCombinedIndexToFleetRef(targetSide, targets[i] ?? -1, snap);
    if (!attackerRef || !targetRef) continue;

    const dmg = clampDmg(damages[i] ?? 0);
    if (dmg <= 0) continue;

    const cl = criticals[i] ?? -1;
    events.push({
      attacker: attackerRef,
      attackerSide,
      attackerRawIndex: i,
      hits: [{
        target: targetRef,
        damage: dmg,
        critical: cl >= 0 ? cl : undefined,
      }],
    });
  }
}

function pushTorpedoListItemEvents(
  events: AttackEvent[],
  attackerSide: BattleSide,
  targetSide: BattleSide,
  rawTargetRows: Array<Array<number | null> | null> | null | undefined,
  rawDamageRows: Array<Array<number | null> | null> | null | undefined,
  rawCriticalRows: Array<Array<number | null> | null> | null | undefined,
  snap: BattleHpSnapshot
) {
  if (!Array.isArray(rawTargetRows)) return;

  for (let i = 0; i < rawTargetRows.length; i++) {
    const attackerRef = resolveCombinedIndexToFleetRef(attackerSide, i, snap);
    if (!attackerRef) continue;

    const targets = toTorpedoIndexArray(rawTargetRows[i]);
    const damages = toTorpedoDamageArray(rawDamageRows?.[i]);
    const criticals = toTorpedoIndexArray(rawCriticalRows?.[i]);
    const n = Math.max(targets.length, damages.length, criticals.length);
    const hits: DamageInstance[] = [];

    for (let j = 0; j < n; j++) {
      const targetRef = resolveCombinedIndexToFleetRef(targetSide, targets[j] ?? -1, snap);
      if (!targetRef) continue;

      const dmg = clampDmg(damages[j] ?? 0);
      if (dmg <= 0) continue;

      const cl = criticals[j] ?? -1;
      hits.push({
        target: targetRef,
        damage: dmg,
        critical: cl >= 0 ? cl : undefined,
      });
    }

    if (hits.length) {
      events.push({
        attacker: attackerRef,
        attackerSide,
        attackerRawIndex: i,
        hits,
      });
    }
  }
}

function pushDamageArrayToFleet(
  hits: DamageInstance[],
  side: BattleSide,
  fleet: BattleFleet,
  rawArr: Array<number | null> | null | undefined,
  snap: BattleHpSnapshot
) {
  // 友方伤害数组是 0-indexed，敌方按 api_ship_ke 的 dummy-head 约定走。
  const arr = side === 'friend' ? toFriendDamageArray(rawArr) : normalizeHpArray(rawArr);
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
