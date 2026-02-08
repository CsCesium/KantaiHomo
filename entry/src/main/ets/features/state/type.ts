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

/** 舰船状态 */
export interface ShipState {
  uid: number;
  masterId: number;
  level: number;
  hpNow: number;
  hpMax: number;
  cond: number;
  fuel: number;
  ammo: number;
  /** HP 百分比 */
  hpPercent: number;
  /** 是否大破 (HP <= 25%) */
  isTaiha: boolean;
  /** 是否中破 (HP <= 50%) */
  isChuuha: boolean;
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
  /** 舰船状态 Map (uid -> ShipState) */
  ships: Map<number, ShipState>;
  /** 上次更新时间 */
  lastUpdatedAt: number;
}

/** 状态变更类型 */
export type StateChangeType =
  | 'admiral'
    | 'materials'
    | 'decks'
    | 'ndocks'
    | 'ships'
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

/** 战果信息（基于经验计算） */
export interface SenkaInfo {
  /** 今日获得经验 */
  todayExp: number;
  /** 预估战果 (经验 / 1428) */
  estimatedSenka: number;
  /** 记录开始时间 */
  startTime: number;
  /** 记录开始时的经验 */
  startExp: number;
}