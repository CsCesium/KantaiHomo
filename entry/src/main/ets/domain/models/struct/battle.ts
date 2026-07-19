export type BattleSide = 'friend' | 'enemy';
export type BattleFleet = 'main' | 'escort';

export type BattlePhaseKind =
    | 'airBase'
    | 'air'
    | 'supportAir'
    | 'supportShelling'
    | 'openingASW'
    | 'openingTorpedo'
    | 'shelling1'
    | 'shelling2'
    | 'shelling3'
    | 'torpedo'
    | 'nightShelling'
    | 'nightTorpedo';

export interface FleetRef {
  side: BattleSide;
  fleet: BattleFleet;
  /** 0-based index within that fleet */
  idx: number;
}

export interface BattleHpFleet {
  now: number[];
  max: number[];
}

export interface BattleHpSnapshot {
  friend: {
    main: BattleHpFleet;
    escort?: BattleHpFleet;
  };
  enemy: {
    main: BattleHpFleet;
    escort?: BattleHpFleet;
  };
}

export interface DamageInstance {
  target: FleetRef;
  damage: number;
  critical?: number; // 0 miss, 1 hit, 2 crit (depends on phase)
  hitIndex?: number; // original index within the API hit list, before zero-damage hits are filtered
}

export interface AttackEvent {
  /** Some phases don't have a meaningful single attacker (e.g. air/base/support) */
  attacker?: FleetRef;
  attackerSide?: BattleSide;
  attackerRawIndex?: number; // original api index (1-based etc)
  attackType?: number; // api_at_type etc
  hits: DamageInstance[];
}


export interface BattlePhase {
  kind: BattlePhaseKind;
  /** for ordering phases in UI */
  seq: number;
  /** original key for debugging */
  rawKey?: string;
  events: AttackEvent[];
}

export interface BattleFormation {
  friend?: number;
  enemy?: number;
  engagement?: number;
}


/** 敌方舰队信息（含 master id、等级、装备、HP） */
export interface EnemyFleetInfo {
  shipIds: number[];      // master id (api_ship_ke)
  levels: number[];       // api_ship_lv
  slots?: number[][];     // api_eSlot
  params?: number[][];    // api_eParam [火力, 雷装, 对空, 装甲]
  hpNow: number[];
  hpMax: number[];
}

/** 航空战单阶段机数损耗（stage1=制空争夺, stage2=对空炮火） */
export interface AerialStageInfo {
  /** 友方参战机数 */
  friendCount: number;
  /** 友方损失机数 */
  friendLost: number;
  /** 敌方参战机数 */
  enemyCount: number;
  /** 敌方损失机数 */
  enemyLost: number;
}

/** 对空CI发动信息（api_stage2.api_air_fire） */
export interface AntiAirCutInInfo {
  /** 发动舰下标（0-based，主力+护卫顺序） */
  shipIdx: number;
  /** CI 种别 (api_kind) */
  kind: number;
  /** 使用装备图鉴 ID 列表 (api_use_items) */
  useItemIds: number[];
}

/** 单次主舰队航空战情报（api_kouku / api_kouku2 各一项） */
export interface AerialCombatInfo {
  /** 制空状態 (1=確保, 2=優勢, 3=均衡, 4=劣勢, 5=喪失) */
  airState?: number;
  /** S1 阶段（制空争夺）机数 */
  stage1?: AerialStageInfo;
  /** S2 阶段（对空炮火）机数 */
  stage2?: AerialStageInfo;
  /** 友方触接机图鉴 ID（未触接时 undefined） */
  touchFriend?: number;
  /** 敌方触接机图鉴 ID（未触接时 undefined） */
  touchEnemy?: number;
  /** 对空CI（未发动时 undefined） */
  airFire?: AntiAirCutInInfo;
}

/** 陆航（基地航空队）单波次情报（api_air_base_attack 数组每项） */
export interface LbasWaveInfo {
  /** 所属基地航空队 ID (api_base_id) */
  baseId: number;
  /** 各中队派出机数 (api_squadron_plane[].api_count) */
  squadronCounts: number[];
  /** 该波次制空状態 */
  airState?: number;
  stage1?: AerialStageInfo;
  stage2?: AerialStageInfo;
  touchFriend?: number;
  touchEnemy?: number;
}

export interface BattleMeta {
  apiPath: string;
  deckId?: number;
  formation?: BattleFormation;
  midnightFlag?: number;
  search?: number[];
  stageFlag?: number[];
  smokeType?: number;

  /** 制空状態 (1=確保, 2=優勢, 3=均衡, 4=劣勢, 5=喪失) */
  airState?: number;
  /** 友方参战机残机数（S1 总数扣除 S1/S2 损失；S2 count 本身只含攻击机） */
  friendPlaneNow?: number;
  /** 友方参战机初期数（来自首个可用阶段） */
  friendPlaneMax?: number;
  /** 敌方参战机残机数（S1 总数扣除 S1/S2 损失） */
  enemyPlaneNow?: number;
  /** 敌方参战机初期数（来自首个可用阶段） */
  enemyPlaneMax?: number;

  /** 主舰队航空战情报（api_kouku / api_kouku2 各一项，含 S1/S2、触接、对空CI） */
  aerialPhases?: AerialCombatInfo[];
  /** 陆航攻击各波次情报 (api_air_base_attack) */
  lbasWaves?: LbasWaveInfo[];
  /** 基地空袭受损种类 (api_lost_kind: 1=资源, 2=资源+航空队, 3=航空队, 4=无损) */
  airRaidDamageKind?: number;

  /** optional: for later advanced UI */
  balloonCell?: number;
  atollCell?: number;
}


export interface BattleSegment {
  meta: BattleMeta;

  /** initial HP snapshot at the moment this API returns */
  start: BattleHpSnapshot;

  /** ordered phases extracted from payload */
  phases: BattlePhase[];

  /** end HP after applying all damages in phases */
  end: BattleHpSnapshot;

  enemyMain?: EnemyFleetInfo;
  enemyEscort?: EnemyFleetInfo;

  createdAt: number;
}

export interface MergeBattleOptions {
  /** allow merging day+night segments into one by appending phases */
  keepStartFromFirst?: boolean;
}

export function mergeBattleSegments(a: BattleSegment, b: BattleSegment, opt: MergeBattleOptions = {}): BattleSegment {
  const keepStart = opt.keepStartFromFirst ?? true;

  const mergeFleet = (first: BattleHpFleet | undefined, second: BattleHpFleet | undefined): BattleHpFleet | undefined => {
    if (second && (second.now.length > 0 || second.max.length > 0)) return second;
    return first;
  };
  const mergedEnd: BattleHpSnapshot = {
    friend: {
      main: mergeFleet(a.end.friend.main, b.end.friend.main) ?? { now: [], max: [] },
      escort: mergeFleet(a.end.friend.escort, b.end.friend.escort),
    },
    enemy: {
      main: mergeFleet(a.end.enemy.main, b.end.enemy.main) ?? { now: [], max: [] },
      escort: mergeFleet(a.end.enemy.escort, b.end.enemy.escort),
    },
  };
  const merged: BattleSegment = {
    meta: {
      ...a.meta,
      apiPath: `${a.meta.apiPath}+${b.meta.apiPath}`,
      deckId: a.meta.deckId ?? b.meta.deckId,
      formation: a.meta.formation ?? b.meta.formation,
      airState: a.meta.airState ?? b.meta.airState,
      friendPlaneNow: a.meta.friendPlaneNow ?? b.meta.friendPlaneNow,
      friendPlaneMax: a.meta.friendPlaneMax ?? b.meta.friendPlaneMax,
      enemyPlaneNow: a.meta.enemyPlaneNow ?? b.meta.enemyPlaneNow,
      enemyPlaneMax: a.meta.enemyPlaneMax ?? b.meta.enemyPlaneMax,
      aerialPhases: a.meta.aerialPhases ?? b.meta.aerialPhases,
      lbasWaves: a.meta.lbasWaves ?? b.meta.lbasWaves,
    },
    start: keepStart ? a.start : b.start,
    phases: [...a.phases, ...b.phases].map((p, i) => ({ ...p, seq: i + 1 })),
    // Night packets frequently contain only the active deck. Keep the other
    // fleets at their day-battle end HP instead of dropping or relabelling them.
    end: mergedEnd,
    enemyMain:   b.enemyMain   ?? a.enemyMain,
    enemyEscort: b.enemyEscort ?? a.enemyEscort,
    createdAt: Math.min(a.createdAt, b.createdAt),
  };
  return merged;
}
