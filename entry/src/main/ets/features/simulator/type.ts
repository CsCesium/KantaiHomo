/**
 * features/battle/simulator/type.ts
 *
 * 舰战模拟器核心类型定义
 * 移植自 poi/lib/utils/simulator.js，去除 poi 特有字段，适配 OHOS/ArkTS 标准 API 数据结构。
 */

// ─── Stage ───────────────────────────────────────────────────────────────────

export const StageType = {
  // Primary types
  Aerial:    'Aerial',    // 航空战
  Torpedo:   'Torpedo',   // 雷击
  Shelling:  'Shelling',  // 炮击
  Support:   'Support',   // 支援
  LandBase:  'LandBase',  // 基地航空
  Engagement:'Engagement',// 交战形式信息（特殊 stage）
  // Sub types
  Main:      'Main',      // 主力舰队炮击
  Escort:    'Escort',    // 护卫舰队炮击
  Night:     'Night',     // 夜战
  Opening:   'Opening',   // 开幕雷击 / 开幕对潜
  Assault:   'Assault',   // 喷射机先制攻击
} as const;
export type StageType = typeof StageType[keyof typeof StageType];

// ─── Attack ──────────────────────────────────────────────────────────────────

export const AttackType = {
  Normal:               'Normal',
  Laser:                'Laser',
  Double:               'Double',
  Nelson_Touch:         'Nelson',
  Nagato_Punch:         'Nagato',
  Mutsu_Splash:         'Mutsu',
  Colorado_Fire:        'Colorado',
  Kongo_Class_Kaini_C:  'Kongo_Class_Kaini_C',
  Yamato_Attack_Double: 'Yamato_Double',
  Yamato_Attack_Triple: 'Yamato_Triple',
  Baguette_Charge:      'Baguette_Charge',
  QE_Touch:             'QE_Touch',
  Submarine_Special_Attack_2_3: 'Submarine_Special_Attack_2_3',
  Submarine_Special_Attack_3_4: 'Submarine_Special_Attack_3_4',
  Submarine_Special_Attack_2_4: 'Submarine_Special_Attack_2_4',
  Zuiun_Night_Attack:   'Zuiyun_Night_Attack',
  Type_4_LC_Special_Attack: 'Type_4_LC_Special_Attack',
  Carrier_CI:           'CVCI',
  Primary_Secondary_CI: 'PSCI',
  Primary_Radar_CI:     'PRCI',
  Primary_AP_CI:        'PACI',
  Primary_Primary_CI:   'PrCI',
  Primary_Torpedo_CI:   'PTCI',
  Torpedo_Torpedo_CI:   'TTCI',
} as const;
export type AttackType = typeof AttackType[keyof typeof AttackType];

export const MultiTargetAttackType = new Set<AttackType>([
  AttackType.Nelson_Touch,
  AttackType.Nagato_Punch,
  AttackType.Mutsu_Splash,
  AttackType.Colorado_Fire,
  AttackType.Kongo_Class_Kaini_C,
  AttackType.Yamato_Attack_Double,
  AttackType.Yamato_Attack_Triple,
  AttackType.Baguette_Charge,
  AttackType.QE_Touch,
  AttackType.Submarine_Special_Attack_2_3,
  AttackType.Submarine_Special_Attack_3_4,
  AttackType.Submarine_Special_Attack_2_4,
  AttackType.Zuiun_Night_Attack,
  AttackType.Laser,
  AttackType.Type_4_LC_Special_Attack,
]);

/** 多目标特殊攻击的攻击者偏移顺序 */
export const MultiTargetAttackOrder: Partial<Record<AttackType, number[]>> = {
  [AttackType.Nelson_Touch]:         [0, 2, 4],
  [AttackType.Nagato_Punch]:         [0, 0, 1],
  [AttackType.Mutsu_Splash]:         [0, 0, 1],
  [AttackType.Colorado_Fire]:        [0, 1, 2],
  [AttackType.Kongo_Class_Kaini_C]:  [0, 1],
  [AttackType.Yamato_Attack_Double]: [0, 0, 1],
  [AttackType.Yamato_Attack_Triple]: [0, 1, 2],
  [AttackType.Baguette_Charge]:      [0, 0, 1],
  [AttackType.QE_Touch]:             [0, 0, 1],
  [AttackType.Submarine_Special_Attack_2_3]: [1, 1, 2, 2],
  [AttackType.Submarine_Special_Attack_3_4]: [2, 2, 3, 3],
  [AttackType.Submarine_Special_Attack_2_4]: [1, 1, 3, 3],
  [AttackType.Zuiun_Night_Attack]:   [0, 0],
  [AttackType.Laser]:                [0, 0, 0],
  [AttackType.Type_4_LC_Special_Attack]: [0, 0, 0, 0, 0, 0],
};

export const HitType = { Miss: 0, Hit: 1, Critical: 2 } as const;
export type HitType = typeof HitType[keyof typeof HitType];

// ─── Ship ────────────────────────────────────────────────────────────────────

export const ShipOwner = {
  Ours:   'Ours',
  Enemy:  'Enemy',
  Friend: 'Friend',
} as const;
export type ShipOwner = typeof ShipOwner[keyof typeof ShipOwner];

/** [firepower, torpedo, AA, armor] */
export type Param4 = [number, number, number, number];

export interface ShipOpts {
  id:         number;
  owner:      ShipOwner;
  pos:        number;
  maxHP:      number;
  nowHP:      number;
  lostHP?:    number;
  damage?:    number;
  items?:     (number | null)[];
  useItem?:   number | null;
  baseParam?: Param4;
  finalParam?: Param4;
  /** 原始 API 数据，可选 */
  raw?:       RawFleetShip | null;
}

export class SimShip {
  id:         number;
  owner:      ShipOwner;
  pos:        number;
  maxHP:      number;
  nowHP:      number;
  initHP:     number;
  lostHP:     number;
  /** 该舰本场战斗造成的伤害累计 */
  damage:     number;
  items:      (number | null)[];
  useItem:    number | null;
  baseParam?: Param4;
  finalParam?: Param4;
  raw?:       RawFleetShip | null;

  constructor(opts: ShipOpts) {
    this.id         = opts.id;
    this.owner      = opts.owner;
    this.pos        = opts.pos;
    this.maxHP      = opts.maxHP;
    this.nowHP      = opts.nowHP;
    this.initHP     = opts.nowHP;
    this.lostHP     = opts.lostHP ?? 0;
    this.damage     = opts.damage ?? 0;
    this.items      = opts.items ?? [];
    this.useItem    = opts.useItem ?? null;
    this.baseParam  = opts.baseParam;
    this.finalParam = opts.finalParam;
    this.raw        = opts.raw ?? null;
  }
}

// ─── Aerial / Engagement Info ────────────────────────────────────────────────

export interface AerialInfoOpts {
  fPlaneInit?:  number; fPlaneNow?:  number;
  ePlaneInit?:  number; ePlaneNow?:  number;
  control?:     AirControl;
  fContact?:    number | null; eContact?: number | null;
  fPlaneInit1?: number; fPlaneNow1?: number;
  ePlaneInit1?: number; ePlaneNow1?: number;
  aaciKind?:    number | null; aaciShip?: SimShip | null; aaciItems?: number[];
  fPlaneInit2?: number; fPlaneNow2?: number;
  ePlaneInit2?: number; ePlaneNow2?: number;
}

export class AerialInfo {
  fPlaneInit?: number; fPlaneNow?: number;
  ePlaneInit?: number; ePlaneNow?: number;
  control?: AirControl;
  fContact?: number | null; eContact?: number | null;
  fPlaneInit1?: number; fPlaneNow1?: number;
  ePlaneInit1?: number; ePlaneNow1?: number;
  aaciKind?: number | null; aaciShip?: SimShip | null; aaciItems?: number[];
  fPlaneInit2?: number; fPlaneNow2?: number;
  ePlaneInit2?: number; ePlaneNow2?: number;
  constructor(opts: AerialInfoOpts = {}) { Object.assign(this, opts); }
}

export interface EngagementInfoOpts {
  engagement?: Engagement;
  fFormation?: Formation; eFormation?: Formation;
  fDetection?: Detection; eDetection?: Detection;
  fContact?: number | null; eContact?: number | null;
  fFlare?: SimShip | null;  eFlare?: SimShip | null;
  weakened?: unknown;
  smokeType?: number;
}

export class EngagementInfo {
  engagement?: Engagement;
  fFormation?: Formation; eFormation?: Formation;
  fDetection?: Detection; eDetection?: Detection;
  fContact?: number | null; eContact?: number | null;
  fFlare?: SimShip | null;  eFlare?: SimShip | null;
  weakened?: unknown;
  smokeType?: number;
  constructor(opts: EngagementInfoOpts = {}) { Object.assign(this, opts); }
}

// ─── Stage / Attack ───────────────────────────────────────────────────────────

export interface AttackOpts {
  type:      AttackType;
  fromShip?: SimShip | null;
  toShip?:   SimShip | null;
  damage:    number[];
  hit:       HitType[];
  fromHP?:   number;
  toHP?:     number;
  useItem?:  number | null;
}

export class SimAttack {
  type:      AttackType;
  fromShip?: SimShip | null;
  toShip?:   SimShip | null;
  damage:    number[];
  hit:       HitType[];
  fromHP?:   number;
  toHP?:     number;
  useItem?:  number | null;
  constructor(opts: AttackOpts) { Object.assign(this, opts); }
}

export interface StageOpts {
  type:         StageType;
  subtype?:     StageType | null;
  attacks?:     SimAttack[];
  aerial?:      AerialInfo | null;
  engagement?:  EngagementInfo | null;
  kouku?:       unknown;
}

export class SimStage {
  type:        StageType;
  subtype?:    StageType | null;
  attacks:     SimAttack[];
  aerial?:     AerialInfo | null;
  engagement?: EngagementInfo | null;
  kouku?:      unknown;
  constructor(opts: StageOpts) {
    this.type       = opts.type;
    this.subtype    = opts.subtype ?? null;
    this.attacks    = opts.attacks ?? [];
    this.aerial     = opts.aerial ?? null;
    this.engagement = opts.engagement ?? null;
    this.kouku      = opts.kouku;
  }
}

// ─── Result / Rank ───────────────────────────────────────────────────────────

export const Rank = {
  SS: 'SS', S: 'S', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E',
} as const;
export type Rank = typeof Rank[keyof typeof Rank];

export interface ResultOpts {
  rank?:    Rank;
  mvp?:     [number, number];
  getShip?: number;
  getItem?: number;
}

export class SimResult {
  rank?:    Rank;
  /** [mainFleet MVP index, escortFleet MVP index] */
  mvp?:     [number, number];
  getShip?: number;
  getItem?: number;
  constructor(opts: ResultOpts = {}) { Object.assign(this, opts); }
}

// ─── Enum-like Maps ──────────────────────────────────────────────────────────

export const AirControl = {
  Supremacy:    'Air Supremacy',
  Superiority:  'Air Superiority',
  Parity:       'Air Parity',
  Denial:       'Air Denial',
  Incapability: 'Air Incapability',
} as const;
export type AirControl = typeof AirControl[keyof typeof AirControl];

export const Engagement = {
  Parallel:     'Parallel Engagement',
  Headon:       'Head-on Engagement',
  TAdvantage:   'Crossing the T (Advantage)',
  TDisadvantage:'Crossing the T (Disadvantage)',
} as const;
export type Engagement = typeof Engagement[keyof typeof Engagement];

export const Formation = {
  Ahead:            'Line Ahead',
  Double:           'Double Line',
  Diamond:          'Diamond',
  Echelon:          'Echelon',
  Abreast:          'Line Abreast',
  Vanguard:         'Vanguard',
  CruisingAntiSub:  'Cruising Formation 1 (anti-sub)',
  CruisingForward:  'Cruising Formation 2 (forward)',
  CruisingDiamond:  'Cruising Formation 3 (diamond)',
  CruisingBattle:   'Cruising Formation 4 (battle)',
} as const;
export type Formation = typeof Formation[keyof typeof Formation];

export const Detection = {
  Success:   'Success',   Failure:   'Failure',
  SuccessNR: 'Success (not return)', FailureNR: 'Failure (not return)',
  SuccessNP: 'Success (without plane)', FailureNP: 'Failure (without plane)',
} as const;
export type Detection = typeof Detection[keyof typeof Detection];

// ─── API mapping tables ───────────────────────────────────────────────────────

export const DayAttackTypeMap: Record<number, AttackType> = {
  0: AttackType.Normal, 1: AttackType.Laser, 2: AttackType.Double,
  3: AttackType.Primary_Secondary_CI, 4: AttackType.Primary_Radar_CI,
  5: AttackType.Primary_AP_CI, 6: AttackType.Primary_Primary_CI,
  7: AttackType.Carrier_CI,
  100: AttackType.Nelson_Touch, 101: AttackType.Nagato_Punch,
  102: AttackType.Mutsu_Splash, 103: AttackType.Colorado_Fire,
  105: AttackType.Baguette_Charge, 106: AttackType.QE_Touch,
  300: AttackType.Submarine_Special_Attack_2_3,
  301: AttackType.Submarine_Special_Attack_3_4,
  302: AttackType.Submarine_Special_Attack_2_4,
  400: AttackType.Yamato_Attack_Triple, 401: AttackType.Yamato_Attack_Double,
  1000: AttackType.Type_4_LC_Special_Attack,
};

export const NightAttackTypeMap: Record<number, AttackType> = {
  0: AttackType.Normal, 1: AttackType.Double,
  2: AttackType.Primary_Torpedo_CI, 3: AttackType.Torpedo_Torpedo_CI,
  4: AttackType.Primary_Secondary_CI, 5: AttackType.Primary_Primary_CI,
  100: AttackType.Nelson_Touch, 101: AttackType.Nagato_Punch,
  102: AttackType.Mutsu_Splash, 103: AttackType.Colorado_Fire,
  104: AttackType.Kongo_Class_Kaini_C, 105: AttackType.Baguette_Charge,
  106: AttackType.QE_Touch, 200: AttackType.Zuiun_Night_Attack,
  300: AttackType.Submarine_Special_Attack_2_3,
  301: AttackType.Submarine_Special_Attack_3_4,
  302: AttackType.Submarine_Special_Attack_2_4,
  400: AttackType.Yamato_Attack_Triple, 401: AttackType.Yamato_Attack_Double,
  1000: AttackType.Type_4_LC_Special_Attack,
};

export const AirControlMap: Record<number, AirControl> = {
  0: AirControl.Parity, 1: AirControl.Supremacy, 2: AirControl.Superiority,
  3: AirControl.Denial, 4: AirControl.Incapability,
};

export const DetectionMap: Record<number, Detection> = {
  1: Detection.Success,   2: Detection.SuccessNR, 3: Detection.FailureNR,
  4: Detection.Failure,   5: Detection.SuccessNP, 6: Detection.FailureNP,
};

export const FormationMap: Record<number, Formation> = {
  1: Formation.Ahead, 2: Formation.Double, 3: Formation.Diamond,
  4: Formation.Echelon, 5: Formation.Abreast, 6: Formation.Vanguard,
  11: Formation.CruisingAntiSub, 12: Formation.CruisingForward,
  13: Formation.CruisingDiamond, 14: Formation.CruisingBattle,
};

export const EngagementMap: Record<number, Engagement> = {
  1: Engagement.Parallel, 2: Engagement.Headon,
  3: Engagement.TAdvantage, 4: Engagement.TDisadvantage,
};

export const SupportTypeMap: Record<number, StageType> = {
  1: StageType.Aerial, 2: StageType.Shelling, 3: StageType.Torpedo,
};

export const BattleRankMap: Record<string, Rank> = {
  SS: Rank.SS, S: Rank.S, A: Rank.A, B: Rank.B, C: Rank.C, D: Rank.D, E: Rank.E,
};

// ─── Raw API data shapes ─────────────────────────────────────────────────────

/**
 * 我方舰娘原始数据结构（标准 KanColle API，非 poi 特有）
 * 对应 api_ship[] 或 api_ship_data[] 条目
 */
export interface RawFleetShip {
  api_ship_id:  number;
  api_maxhp:    number;
  api_nowhp:    number;
  /** 装备槽 slot item IDs，[4]，空槽为 -1 */
  api_slot:     number[];
  /** 补强增设槽 slot item ID，无则为 -1 */
  api_slot_ex?: number;
  /** 近代化改修值 [firepower, torpedo, aa, armor, luck, hp, asw] */
  api_kyouka?:  number[];
  /** 现在火力 [current, max] */
  api_karyoku?:  [number, number];
  api_raisou?:   [number, number];
  api_taiku?:    [number, number];
  api_soukou?:   [number, number];
}

/** 简化的舰娘 master data 条目（仅取 simulator 需要的字段） */
export interface ShipMasterEntry {
  api_houg: [number, number]; // base firepower [min, max]
  api_raig: [number, number];
  api_tyku: [number, number];
  api_souk: [number, number];
}

/** 简化的装备 master data 条目 */
export interface SlotItemMasterEntry {
  api_houg?: number;
  api_raig?: number;
  api_tyku?: number;
  api_souk?: number;
}

/**
 * Master data 提供者接口，供 Simulator 查询 master data。
 * 若未提供（或查不到），Simulator 会跳过 param 计算，仅做 HP 追踪。
 */
export interface MasterDataProvider {
  getShip(id: number): ShipMasterEntry | undefined;
  getSlotItem(id: number): SlotItemMasterEntry | undefined;
}

// ─── Fleet 输入结构 ─────────────────────────────────────────────────────────

export interface FleetInput {
  /** 舰队类型 0=通常 1=空母机动 2=水上打击 3=输送护卫 */
  type:    number;
  main?:   (RawFleetShip | null)[];
  escort?: (RawFleetShip | null)[];
  support?: (RawFleetShip | null)[];
  LBAC?:   unknown;
}

/** 经过处理的模拟器可用舰队快照（按 stage 聚合后供 UI 消费） */
export interface SimPrediction {
  stages:      SimStage[];
  mainFleet:   (SimShip | null)[] | undefined;
  escortFleet: (SimShip | null)[] | undefined;
  enemyFleet:  (SimShip | null)[] | null;
  enemyEscort: (SimShip | null)[] | null;
  result:      SimResult;
}
