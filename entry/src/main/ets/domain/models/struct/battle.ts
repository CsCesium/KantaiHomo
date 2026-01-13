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


export interface BattleEnemyInfo {
  /** master ids (api_ship_ke) */
  mainKe?: number[];
  mainLv?: number[];
  escortKe?: number[];
  escortLv?: number[];
}

export interface BattleMeta {
  apiPath: string;
  deckId?: number;
  formation?: BattleFormation;
  midnightFlag?: number;
  search?: number[];
  stageFlag?: number[];
  smokeType?: number;

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

  enemy?: BattleEnemyInfo;

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
    enemy: b.enemy ?? a.enemy,
    createdAt: Math.min(a.createdAt, b.createdAt),
  };
  return merged;
}
