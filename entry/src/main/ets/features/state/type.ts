// ==================== 状态类型定义 ====================

/** 提督快照（用于计算经验/战果变化） */
export interface AdmiralSnapshot {
  memberId: number;
  nickname: string;
  level: number;
  experience: number;
  rank?: number;
  capturedAt: number;
}

/** 资源快照 */
export interface MaterialsSnapshot {
  fuel: number;
  ammo: number;
  steel: number;
  bauxite: number;
  instantBuild: number;
  instantRepair: number;
  devMaterial: number;
  screw: number;
  capturedAt: number;
}

/** 舰队快照 */
export interface DeckSnapshot {
  deckId: number;
  name: string;
  shipUids: number[];
  /** 远征状态：null=未远征，否则为返回时间戳 */
  expeditionReturnTime: number | null;
  /** 远征任务 ID */
  expeditionMissionId: number;
  capturedAt: number;
}

/** 修理渠快照 */
export interface NDockSnapShot{
  dockId:number;
  state:number;
  shipUid:number;
  completeTime:number;
  capturedAt: number;
}

/** 建造渠快照 */
export interface KDockSnapShot{
  dockId:number;
  state:number;
  createdShipMasterId:number;
  completeTime:number;
  capturedAt: number;
}

/** 任务快照 */
export interface QuestSnapshot {
  questId: number;
  title: string;
  state: number;
  category: number;
  type: number;
  progress?: number;
  updatedAt: number;
  capturedAt: number;
}

/** 舰船状态 */
export interface ShipState {
  uid: number;
  masterId: number;
  /** 舰娘名称（来自舰船图鉴） */
  name: string;
  level: number;
  hpNow: number;
  hpMax: number;
  cond: number;
  fuel: number;
  ammo: number;
  /** 最大燃料（来自舰船图鉴，0表示未知） */
  fuelMax: number;
  /** 最大弹药（来自舰船图鉴，0表示未知） */
  ammoMax: number;
  /** 是否需要补给 */
  needsResupply: boolean;
  /** 装备槽 (装备实例 UID 列表，长度5，-1=未装备) */
  slots: number[];
  /** 各槽当前搭载数（与 slots 并行） */
  onslot: number[];
  /** 实际装备槽数量 */
  slotCount: number;
  /** 扩张装备槽 UID（0=未解锁，-1=未装备，>0=装备UID） */
  exSlot: number;
  /** HP 百分比 */
  hpPercent: number;
  /** 是否大破 (HP <= 25%) */
  isTaiha: boolean;
  /** 是否中破 (HP <= 50%) */
  isChuuha: boolean;
}

/** 舰娘特殊装备状态（损管/女神） */
export interface ShipSpecialEquip {
  /** 是否装备损管 (応急修理要員, masterId=42) */
  hasDamageControl: boolean;
  /** 是否装备女神 (応急修理女神, masterId=43) */
  hasGoddess: boolean;
}

/** 完整游戏状态 */
export interface GameState {
  /** 提督信息 */
  admiral: AdmiralSnapshot | null;
  /** 资源 */
  materials: MaterialsSnapshot | null;
  /** 四个舰队 */
  decks: DeckSnapshot[];
  /** 修理渠状态 */
  Ndocks:NDockSnapShot[];
  /** 修理渠状态 */
  Kdocks:KDockSnapShot[];
  /** 当前任务状态 */
  quests: QuestSnapshot[];
  /** 舰船状态 Map (uid -> ShipState) */
  ships: Map<number, ShipState>;
  /** 当前战斗状态 (暂态) */
  currentBattle: CurrentBattleState;
  /** 地图血量快照（来自 api_get_member/mapinfo） */
  mapGauges: MapGaugeSnapshot[];
  /** 基地航空队状态（来自 api_get_member/base_air_corps 等） */
  lbases: import('../../domain/models/struct/lbas').LbasBase[];
  /** 上次更新时间 */
  lastUpdatedAt: number;

  // ── 派生数据缓存（从 start2/port 填充，用于 ShipState 派生字段） ──
  /** 舰船图鉴名称缓存 (masterId → name) */
  shipMasterNames: Map<number, string>;
  /** 舰船图鉴最大补给量缓存 (masterId → { fuelMax, ammoMax }) */
  shipMasterMaxSupply: Map<number, { fuelMax: number; ammoMax: number }>;
  /** 舰船图鉴速力缓存 (masterId → api_soku, 0=陆上基地, 5=低速, 10=高速...) */
  shipMasterSoku: Map<number, number>;
  /** 装备图鉴类型缓存 (slotitem masterId → typeEquipType) */
  slotItemEquipTypes: Map<number, number>;
  /** 装备图鉴图标缓存 (slotitem masterId → api_type[3]) */
  slotItemIconTypes: Map<number, number>;
  /** 装备实例索引 (slotitem uid → masterId) */
  slotItemIndex: Map<number, number>;
  /** 装备改修度 (slotitem uid → api_level, 0..10) */
  slotItemLevels: Map<number, number>;
  /** 装备熟练度 (slotitem uid → api_alv, 0..7) */
  slotItemAlvs: Map<number, number>;
  /** 舰娘图像文件名缓存 (masterId → api_filename) */
  shipGraphFilenames: Map<number, string>;
  /** 游戏服务器基础 URL（从 api_start2 请求中提取）*/
  gameServerUrl: string | null;
}

/** 地图血量/进度快照（来自 api_get_member/mapinfo） */
export interface MapGaugeSnapshot {
  /** 地图复合 ID：海域*10+地图编号（如 15=1-5, 25=2-5） */
  mapId: number;
  /** 是否已通关 */
  cleared: boolean;
  /** 击破 Boss 次数 */
  defeatCount: number;
  /** 血量条类型：1=HP, 2=TP, null=无血量条 */
  gaugeType: number | null;
  /** 血量条序号（同一地图多条血量时使用） */
  gaugeNum: number;
  /** 当前血量（无血量条时为 null） */
  hpNow: number | null;
  /** 最大血量（无血量条时为 null） */
  hpMax: number | null;
  /** 所需击破次数（EO 地图专用） */
  requiredDefeats: number | null;
  capturedAt: number;
}

/** 状态变更类型 */
export type StateChangeType =
  | 'admiral'
    | 'materials'
    | 'decks'
    | 'ndocks'
    | 'kdocks'
    | 'quests'
    | 'ships'
    | 'battle'
    | 'mapinfo'
    | 'lbas'
    | 'all';

/** 状态变更监听器 */
export type StateChangeListener = (
  changeType: StateChangeType,
  state: GameState
) => void;

/** 经验值变化信息 */
export interface ExpChange {
  /** 变化前经验 */
  before: number;
  /** 变化后经验 */
  after: number;
  /** 变化量 */
  delta: number;
  /** 时间戳 */
  timestamp: number;
}

/** 战绩页面战果快照（实际排行数据） */
export interface RankingSnapshot {
  /** 当前名次 */
  rank: number;
  /** 当月战果点数 */
  senka: number;
  /** 快照时提督经验值（用于估算增量） */
  exp: number;
  /** 提督 memberId */
  memberId: string;
  /** 快照时间戳 */
  capturedAt: number;
}

/** 战果信息（基于经验计算） */
export interface SenkaInfo {
  /** 今日获得经验 */
  todayExp: number;
  /** 今日预估战果增量 (todayExp / 1428) */
  estimatedTodaySenka: number;
  /** 战绩页面战果快照（访问战绩表示后更新） */
  rankingSnapshot: RankingSnapshot | null;
  /** 本月预估总战果：快照战果 + 快照后经验增量估算；无快照时为 null */
  estimatedMonthlySenka: number | null;
  /** 记录开始时间 */
  startTime: number;
  /** 记录开始时的经验 */
  startExp: number;
}

// ==================== 战斗状态快照 ====================

/** 单舰战斗状态 */
export interface ShipBattleStatus {
  /** 舰船UID */
  uid: number;
  /** 舰船名称 */
  name: string;
  /** 战斗前HP */
  hpBefore: number;
  /** 战斗后HP (预测) */
  hpAfter: number;
  /** 最大HP */
  hpMax: number;
  /** 受到的伤害 */
  damageReceived: number;
  /** HP百分比 (战后) */
  hpPercent: number;
  /** 是否击沉 */
  isSunk: boolean;
  /** 是否大破 (≤25%) */
  isTaiha: boolean;
  /** 是否中破 (≤50%) */
  isChuuha: boolean;
  /** 是否小破 (≤75%) */
  isShouha: boolean;
}

/** 舰队战斗状态 */
export interface FleetBattleStatus {
  /** 舰队ID */
  deckId: number;
  /** 舰队名称 */
  name: string;
  /** 各舰状态 */
  ships: ShipBattleStatus[];
  /** 大破舰数量 */
  taihaCount: number;
  /** 击沉舰数量 */
  sunkCount: number;
}

/** 敌方舰队战斗状态 */
export interface EnemyBattleStatus {
  /** 舰船ID列表 (master id) */
  shipIds: number[];
  /** 各舰战前HP */
  hpBefore: number[];
  /** 各舰当前HP (战后预测) */
  hpNow: number[];
  /** 各舰最大HP */
  hpMax: number[];
  /** 击沉数量 */
  sunkCount: number;
}

/** 当前战斗状态快照 (用于前端展示) */
export interface BattleStatusSnapshot {
  /** 战斗ID */
  battleId: string;
  /** 出击ID */
  sortieId: string;

  // 地图信息
  /** 海域ID */
  mapAreaId: number;
  /** 地图编号 */
  mapInfoNo: number;
  /** 格子ID */
  cellId: number;
  /** 是否Boss点 */
  isBoss: boolean;

  // 战斗类型
  /** 战斗种类: day昼战, night夜战, day_to_night昼夜战 */
  battlePhase: 'day' | 'night' | 'day_to_night';
  /** 是否演习 */
  isPractice: boolean;
  /** 是否基地空袭（friend/enemy 双方都是路基/航空编队，使用混乱/损害/损壊/破壊术语） */
  isAirRaid: boolean;
  /** 联合舰队类型 (0=非联合) */
  combinedType: number;

  // 阵型与交战形态
  /** 我方阵型 */
  friendFormation?: number;
  /** 敌方阵型 */
  enemyFormation?: number;
  /** 交战形态 */
  engagement?: number;

  // 友方舰队状态 (预测)
  /** 主力舰队 */
  friendMain: FleetBattleStatus;
  /** 护卫舰队 (联合舰队时) */
  friendEscort?: FleetBattleStatus;

  // 敌方舰队状态 (预测)
  /** 敌主力舰队 */
  enemyMain: EnemyBattleStatus;
  /** 敌护卫舰队 */
  enemyEscort?: EnemyBattleStatus;

  // 预测结果
  /** 预测等级 S/A/B/C/D/E */
  predictedRank: string;
  /** 友方有大破 */
  hasTaihaRisk: boolean;
  /** 友方大破舰列表 */
  taihaShips: { uid: number; name: string; hpPercent: number }[];
  /** 友方有击沉风险 (旗舰以外) */
  hasSunkRisk: boolean;

  // 航空状态
  /** 制空状態 (1=確保, 2=優勢, 3=均衡, 4=劣勢, 5=喪失) */
  airState?: number;
  /** 友方残機数 */
  friendPlaneNow?: number;
  /** 友方初期機数 */
  friendPlaneMax?: number;
  /** 対空CI発動 */
  aaciTriggered?: boolean;

  // 时间戳
  /** 战斗开始时间 */
  startedAt: number;
  /** 预测计算时间 */
  calculatedAt: number;
}

/** 战斗结果快照 (战斗结束后) */
export interface BattleResultSnapshot {
  /** 战斗ID */
  battleId: string;
  /** 出击ID */
  sortieId: string;

  // 地图信息
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  isBoss: boolean;

  // 战斗结果
  /** 实际等级 */
  rank: string;
  /** MVP位置 (1-based) */
  mvp?: number;
  /** 联合第二舰队MVP */
  mvpCombined?: number;
  /** 是否基地空袭 */
  isAirRaid: boolean;

  // 掉落
  /** 掉落舰船ID */
  dropShipId?: number;
  /** 掉落舰船名 */
  dropShipName?: string;
  /** 掉落道具ID */
  dropItemId?: number;

  // 经验
  /** 基础经验 */
  baseExp?: number;

  // 舰队最终状态
  friendMain: FleetBattleStatus;
  friendEscort?: FleetBattleStatus;
  enemyMain: EnemyBattleStatus;
  enemyEscort?: EnemyBattleStatus;

  // 时间戳
  startedAt: number;
  endedAt: number;
}

/** 当前战斗暂态 */
export interface CurrentBattleState {
  /** 当前战斗状态快照 (战斗进行中) */
  status: BattleStatusSnapshot | null;
  /** 战斗结果快照 (战斗结束后) */
  result: BattleResultSnapshot | null;
  /** 最后更新时间 */
  lastUpdatedAt: number;
}

// ==================== utils ====================
export interface shipGraphFilename{
  id: number;
  filename: string;
}