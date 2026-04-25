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
  /** 友方残機数 (after air battle) */
  friendPlaneNow?: number;
  /** 友方初期機数 (before air battle) */
  friendPlaneMax?: number;

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
  const merged: BattleSegment = {
    meta: {
      ...a.meta,
      apiPath: `${a.meta.apiPath}+${b.meta.apiPath}`,
      deckId: a.meta.deckId ?? b.meta.deckId,
      formation: a.meta.formation ?? b.meta.formation,
    },
    start: keepStart ? a.start : b.start,
    phases: [...a.phases, ...b.phases].map((p, i) => ({ ...p, seq: i + 1 })),
    end: b.end,
    enemyMain:   b.enemyMain   ?? a.enemyMain,
    enemyEscort: b.enemyEscort ?? a.enemyEscort,
    createdAt: Math.min(a.createdAt, b.createdAt),
  };
  return merged;
}
