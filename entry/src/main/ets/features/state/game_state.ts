
// ==================== 状态管理类 ====================
import { Admiral, Materials, Deck, Ship, Ndock, Kdock, Quest } from "../../domain/models";
import { kvSet } from "../../infra/storage/kv";
import {
  GameState,
  StateChangeListener,
  ExpChange,
  AdmiralSnapshot,
  MaterialsSnapshot,
  DeckSnapshot,
  ShipState,
  ShipSpecialEquip,
  SenkaInfo,
  RankingSnapshot,
  StateChangeType,
  NDockSnapShot,
  KDockSnapShot,
  CurrentBattleState,
  BattleStatusSnapshot,
  BattleResultSnapshot,
  FleetBattleStatus,
  EnemyBattleStatus,
  ShipBattleStatus
} from "./type";

/**
 * 获取战果统计周期 ID（CST UTC+8 基准）。
 *
 * 战果统计时间为 01:00 和 13:00 (CST)，更新时间为 02:00 和 14:00 (CST)。
 * 按统计时间划分计日周期：
 *   - AM 周期：01:00 ≤ CST < 13:00  → "YYYY-MM-DD-AM"
 *   - PM 周期：13:00 ≤ CST < 01:00(次日) → "YYYY-MM-DD-PM"（日期为 PM 开始当天）
 */
function getCSTSenkaPeriodId(ts?: number): string {
  const ms = ts !== undefined ? ts : Date.now();
  const cstMs = ms + 8 * 60 * 60 * 1000; // CST = UTC+8
  const d = new Date(cstMs);
  const h = d.getUTCHours();

  let y: number;
  let mo: number;
  let day: number;
  let period: string;

  if (h >= 13) {
    // PM 周期：从当天 13:00 开始
    y = d.getUTCFullYear();
    mo = d.getUTCMonth() + 1;
    day = d.getUTCDate();
    period = 'PM';
  } else if (h >= 1) {
    // AM 周期：从当天 01:00 开始
    y = d.getUTCFullYear();
    mo = d.getUTCMonth() + 1;
    day = d.getUTCDate();
    period = 'AM';
  } else {
    // 00:xx CST：属于前一天的 PM 周期
    const yesterday = new Date(cstMs - 24 * 60 * 60 * 1000);
    y = yesterday.getUTCFullYear();
    mo = yesterday.getUTCMonth() + 1;
    day = yesterday.getUTCDate();
    period = 'PM';
  }

  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}-${period}`;
}

/** 损管/女神 master ID 常量 */
const DAMAGE_CONTROL_MASTER_ID = 42;
const GODDESS_MASTER_ID = 43;

class GameStateManager {
  private state: GameState = {
    admiral: null,
    materials: null,
    decks: [],
    Ndocks:[],
    Kdocks:[],
    quests: [],
    ships: new Map(),
    currentBattle: {
      status: null,
      result: null,
      lastUpdatedAt: 0,
    },
    lastUpdatedAt: 0,
    shipMasterNames: new Map(),
    shipMasterMaxSupply: new Map(),
    slotItemEquipTypes: new Map(),
    slotItemIconTypes: new Map(),
    slotItemIndex: new Map(),
  };

  private listeners: Set<StateChangeListener> = new Set();

  private expHistory: ExpChange[] = [];
  private readonly MAX_EXP_HISTORY = 100;

  /** 每日战果追踪（含 CST 周期 ID，用于跨周期重置） */
  private dailySenkaStart: { exp: number; time: number; date: string } | null = null;

  /** 战绩页面战果快照 */
  private rankingSnapshot: RankingSnapshot | null = null;

  // ==================== 状态更新 ====================

  /**
   * 更新提督信息
   */
  updateAdmiral(admiral: Admiral): void {
    const oldExp = this.state.admiral?.experience ?? 0;
    const newExp = admiral.experience;

    this.state.admiral = {
      memberId: admiral.memberId,
      nickname: admiral.nickname,
      level: admiral.level,
      experience: admiral.experience,
      rank: admiral.rank,
      capturedAt: Date.now(),
    };

    // 记录经验变化
    if (oldExp > 0 && newExp !== oldExp) {
      this.recordExpChange(oldExp, newExp);
    }

    // 初始化或跨日重置每日战果追踪
    this.ensureDailySenka(newExp);

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('admiral');
  }

  /**
   * 更新资源
   */
  updateMaterials(materials: Materials): void {
    this.state.materials = {
      fuel: materials.fuel,
      ammo: materials.ammo,
      steel: materials.steel,
      bauxite: materials.bauxite,
      instantBuild: materials.instantBuild,
      instantRepair: materials.instantRepair,
      devMaterial: materials.devMaterial,
      screw: materials.screw,
      capturedAt: Date.now(),
    };

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('materials');
  }
  /**
   * 更新修理渠
   */
  updateNDocks(ndocks:Ndock[]):void{
    this.state.Ndocks = ndocks.map(dock=>({
      dockId:dock.dockId,
      state:dock.state,
      shipUid:dock.shipUid,
      completeTime:dock.completeTime,
      capturedAt:Date.now()
    }));
    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('ndocks');
  }
  /**
   * 更新建造渠
   */
  updateKDocks(kdocks:Kdock[]):void{
    this.state.Kdocks = kdocks.map(dock=>({
      dockId:dock.dockId,
      state:dock.state,
      createdShipMasterId:dock.createdShipMasterId,
      completeTime:dock.completeTime,
      capturedAt:Date.now()
    }));
    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('kdocks');
  }
  /**
   * 更新舰队
   */
  updateDecks(decks: Deck[]): void {
    this.state.decks = decks.map(deck => ({
      deckId: deck.deckId,
      name: deck.name,
      shipUids: [...deck.shipUids],
      expeditionReturnTime: deck.expedition?.returnTime ?? null,
      expeditionMissionId: deck.expedition?.missionId ?? 0,
      capturedAt: Date.now(),
    }));

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('decks');
  }

  /**
   * 更新任务（仅维护当前可见任务页）
   */
  updateQuests(quests: Quest[]): void {
    this.state.quests = quests.map(quest => ({
      questId: quest.questId,
      title: quest.title,
      state: quest.state,
      category: quest.category,
      type: quest.type,
      progress: quest.progress,
      updatedAt: quest.updatedAt,
      capturedAt: Date.now(),
    }));

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('quests');
  }

  /**
   * 更新舰船（批量）
   */
  updateShips(ships: Ship[]): void {
    for (const ship of ships) {
      this.updateShip(ship, false);
    }

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('ships');
  }

  /**
   * 更新单艘舰船
   */
  updateShip(ship: Ship, notify = true): void {
    const hpPercent = ship.hpMax > 0 ? ship.hpNow / ship.hpMax : 1;

    // 从图鉴缓存派生名称和最大补给量
    const name = this.state.shipMasterNames.get(ship.masterId) ?? `#${ship.masterId}`;
    const maxSupply = this.state.shipMasterMaxSupply.get(ship.masterId);
    const fuelMax = maxSupply?.fuelMax ?? 0;
    const ammoMax = maxSupply?.ammoMax ?? 0;
    const needsResupply = fuelMax > 0
      ? (ship.fuel < fuelMax || ship.ammo < ammoMax)
      : false;

    const slots: number[] = Array.isArray(ship.slots) ? [...ship.slots] : [];
    const onslot: number[] = Array.isArray(ship.onslot) ? [...ship.onslot] : [];
    const slotCount: number = typeof ship.slotCount === 'number' ? ship.slotCount : slots.length;
    const exSlot: number = typeof ship.exSlot === 'number' ? ship.exSlot : 0;

    this.state.ships.set(ship.uid, {
      uid: ship.uid,
      masterId: ship.masterId,
      name,
      level: ship.level,
      hpNow: ship.hpNow,
      hpMax: ship.hpMax,
      cond: ship.cond,
      fuel: ship.fuel,
      ammo: ship.ammo,
      fuelMax,
      ammoMax,
      needsResupply,
      slots,
      onslot,
      slotCount,
      exSlot,
      hpPercent,
      isTaiha: hpPercent <= 0.25,
      isChuuha: hpPercent <= 0.5,
    });

    if (notify) {
      this.state.lastUpdatedAt = Date.now();
      this.notifyListeners('ships');
    }
  }

  /**
   * 删除舰船（解体/近代化改修消耗）
   */
  removeShips(uids: number[]): void {
    for (const uid of uids) {
      this.state.ships.delete(uid);
    }

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('ships');
  }

  /**
   * 批量更新（Port 数据）
   */
  updateFromPort(data: {
    admiral?: Admiral;
    materials?: Materials;
    decks?: Deck[];
    ships?: Ship[];
  }): void {
    if (data.admiral) {
      const oldExp = this.state.admiral?.experience ?? 0;
      this.state.admiral = {
        memberId: data.admiral.memberId,
        nickname: data.admiral.nickname,
        level: data.admiral.level,
        experience: data.admiral.experience,
        rank: data.admiral.rank,
        capturedAt: Date.now(),
      };
      if (oldExp > 0 && data.admiral.experience !== oldExp) {
        this.recordExpChange(oldExp, data.admiral.experience);
      }
      this.ensureDailySenka(data.admiral.experience);
    }

    if (data.materials) {
      this.state.materials = {
        fuel: data.materials.fuel,
        ammo: data.materials.ammo,
        steel: data.materials.steel,
        bauxite: data.materials.bauxite,
        instantBuild: data.materials.instantBuild,
        instantRepair: data.materials.instantRepair,
        devMaterial: data.materials.devMaterial,
        screw: data.materials.screw,
        capturedAt: Date.now(),
      };
    }

    if (data.decks) {
      this.state.decks = data.decks.map(deck => ({
        deckId: deck.deckId,
        name: deck.name,
        shipUids: [...deck.shipUids],
        expeditionReturnTime: deck.expedition?.returnTime ?? null,
        expeditionMissionId: deck.expedition?.missionId ?? 0,
        capturedAt: Date.now(),
      }));
    }

    if (data.ships) {
      // 清空旧数据，重新填充
      this.state.ships.clear();
      for (const ship of data.ships) {
        this.updateShip(ship, false);
      }
    }

    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('all');
  }

  // ==================== 状态查询 ====================

  /**
   * 获取完整状态
   */
  getState(): Readonly<GameState> {
    return this.state;
  }

  /**
   * 获取提督信息
   */
  getAdmiral(): AdmiralSnapshot | null {
    return this.state.admiral;
  }

  /**
   * 获取资源
   */
  getMaterials(): MaterialsSnapshot | null {
    return this.state.materials;
  }

  /**
   * 获取修理渠
   */
  getNDocks(): readonly NDockSnapShot[] {
    return this.state.Ndocks;
  }

  /**
   * 获取修理渠
   */
  getKDocks(): readonly KDockSnapShot[] {
    return this.state.Kdocks;
  }


  /**
   * 获取舰队
   */
  getDecks(): readonly DeckSnapshot[] {
    return this.state.decks;
  }

  /**
   * 获取指定舰队
   */
  getDeck(deckId: number): DeckSnapshot | undefined {
    return this.state.decks.find(d => d.deckId === deckId);
  }

  /**
   * 获取任务信息
   */
  getQuests() {
    return this.state.quests;
  }

  /**
   * 获取舰船状态
   */
  getShip(uid: number): ShipState | undefined {
    return this.state.ships.get(uid);
  }

  /**
   * 获取舰队中的舰船状态
   */
  getDeckShips(deckId: number): ShipState[] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];

    return deck.shipUids
      .filter(uid => uid > 0)
      .map(uid => this.state.ships.get(uid))
      .filter(s => s !== undefined);
  }

  /**
   * 获取舰队中的大破舰
   */
  getDeckTaihaShips(deckId: number): ShipState[] {
    return this.getDeckShips(deckId).filter(s => s.isTaiha);
  }

  /**
   * 检查舰队是否有大破舰
   */
  hasTaihaInDeck(deckId: number): boolean {
    return this.getDeckTaihaShips(deckId).length > 0;
  }

  // ==================== 战果计算 ====================

  /**
   * 获取战果信息
   */
  getSenkaInfo(): SenkaInfo | null {
    if (!this.state.admiral) {
      return null;
    }

    const currentExp = this.state.admiral.experience;
    const startExp = this.dailySenkaStart?.exp ?? currentExp;
    const startTime = this.dailySenkaStart?.time ?? Date.now();
    const todayExp = Math.max(0, currentExp - startExp);

    let estimatedMonthlySenka: number | null = null;
    const rs = this.rankingSnapshot;
    if (rs) {
      const expSinceRanking = Math.max(0, currentExp - rs.exp);
      estimatedMonthlySenka = rs.senka + Math.floor(expSinceRanking / 1428);
    }

    return {
      todayExp,
      estimatedTodaySenka: Math.floor(todayExp / 1428),
      rankingSnapshot: rs,
      estimatedMonthlySenka,
      startTime,
      startExp,
    };
  }

  /**
   * 更新战绩排行快照（访问战绩表示页面时调用）
   */
  updateRanking(snapshot: RankingSnapshot): void {
    this.rankingSnapshot = snapshot;
    this.notifyListeners('admiral');
  }

  /**
   * 获取战绩排行快照
   */
  getRankingSnapshot(): RankingSnapshot | null {
    return this.rankingSnapshot;
  }

  /**
   * 从 KV 恢复数据时调用：设置每日战果起点（仅当周期 ID 与当前一致时有效）
   */
  initDailySenka(exp: number, time: number, date: string): void {
    const currentPeriod = getCSTSenkaPeriodId();
    if (date === currentPeriod) {
      this.dailySenkaStart = { exp, time, date: currentPeriod };
      this.notifyListeners('admiral');
    }
  }

  /**
   * 从 KV 恢复数据时调用：设置战绩快照
   */
  initRanking(snapshot: RankingSnapshot): void {
    this.rankingSnapshot = snapshot;
    this.notifyListeners('admiral');
  }

  /**
   * 获取最近的经验变化
   */
  getRecentExpChanges(count = 10): ExpChange[] {
    return this.expHistory.slice(-count);
  }

  /**
   * 强制重置当前周期战果追踪（手动调用）
   */
  resetDailySenka(): void {
    if (this.state.admiral) {
      const period = getCSTSenkaPeriodId();
      this.dailySenkaStart = {
        exp: this.state.admiral.experience,
        time: Date.now(),
        date: period,
      };
      this.persistDailySenka();
    }
  }

  /**
   * 确保战果起点已初始化；周期切换（01:00 / 13:00 CST）时自动重置。
   */
  private ensureDailySenka(currentExp: number): void {
    if (currentExp <= 0) return;
    const period = getCSTSenkaPeriodId();
    if (!this.dailySenkaStart) {
      this.dailySenkaStart = { exp: currentExp, time: Date.now(), date: period };
    } else if (this.dailySenkaStart.date !== period) {
      // CST 周期切换（01:00 或 13:00）：重置起点
      this.dailySenkaStart = { exp: currentExp, time: Date.now(), date: period };
      this.persistDailySenka();
    }
  }

  private persistDailySenka(): void {
    if (!this.dailySenkaStart) return;
    const payload = JSON.stringify(this.dailySenkaStart);
    void kvSet('senka.daily.v1', payload);
  }

  // ==================== 订阅机制 ====================

  /**
   * 订阅状态变更
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(changeType: StateChangeType): void {
    for (const listener of this.listeners) {
      try {
        listener(changeType, this.state);
      } catch (e) {
        console.error('[GameState] listener error:', e);
      }
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 记录经验变化
   */
  private recordExpChange(before: number, after: number): void {
    const change: ExpChange = {
      before,
      after,
      delta: after - before,
      timestamp: Date.now(),
    };

    this.expHistory.push(change);

    // 限制历史记录数量
    if (this.expHistory.length > this.MAX_EXP_HISTORY) {
      this.expHistory.shift();
    }

    console.debug(`[GameState] exp change: ${before} → ${after} (+${change.delta})`);
  }

  /**
   * 清空状态（用于切换账号等场景）
   */
  clear(): void {
    this.state = {
      admiral: null,
      materials: null,
      decks: [],
      Ndocks:[],
      Kdocks:[],
      quests: [],
      ships: new Map(),
      currentBattle: {
        status: null,
        result: null,
        lastUpdatedAt: 0,
      },
      lastUpdatedAt: 0,
      shipMasterNames: new Map(),
      shipMasterMaxSupply: new Map(),
      slotItemEquipTypes: new Map(),
      slotItemIconTypes: new Map(),
      slotItemIndex: new Map(),
    };
    this.expHistory = [];
    this.dailySenkaStart = null;
    this.notifyListeners('all');
  }

  // ==================== 派生数据缓存更新 ====================

  /**
   * 更新舰船图鉴名称及最大补给量缓存（来自 api_start2 舰船图鉴）
   */
  updateShipMasterMeta(items: ReadonlyArray<{ id: number; name: string; fuelMax: number; ammoMax: number }>): void {
    for (const item of items) {
      this.state.shipMasterNames.set(item.id, item.name);
      this.state.shipMasterMaxSupply.set(item.id, { fuelMax: item.fuelMax, ammoMax: item.ammoMax });
    }
  }

  /**
   * 按图鉴 ID 查询舰船名称
   */
  getShipMasterName(masterId: number): string | undefined {
    return this.state.shipMasterNames.get(masterId);
  }

  /**
   * 更新装备图鉴类型缓存（来自 api_start2 装备图鉴，masterId → typeEquipType）
   */
  updateSlotItemEquipTypes(items: ReadonlyArray<{ id: number; equipType: number; iconType: number }>): void {
    for (const item of items) {
      this.state.slotItemEquipTypes.set(item.id, item.equipType);
      this.state.slotItemIconTypes.set(item.id, item.iconType);
    }
  }

  /**
   * 更新装备实例索引（来自 api_port/api_slot_item，uid → masterId）
   */
  updateSlotItemIndex(items: ReadonlyArray<{ uid: number; masterId: number }>): void {
    for (const item of items) {
      this.state.slotItemIndex.set(item.uid, item.masterId);
    }
  }

  /**
   * 获取舰娘的特殊装备状态（损管/女神）
   * 检查舰娘装备槽（包括扩张槽）中是否有损管或女神
   */
  getShipSpecialEquip(uid: number): ShipSpecialEquip {
    const ship = this.state.ships.get(uid);
    if (!ship) return { hasDamageControl: false, hasGoddess: false };

    let hasDamageControl = false;
    let hasGoddess = false;

    const checkSlot = (slotUid: number): void => {
      if (slotUid <= 0) return;
      const masterId = this.state.slotItemIndex.get(slotUid);
      if (masterId === undefined) return;
      if (masterId === GODDESS_MASTER_ID) {
        hasGoddess = true;
      } else if (masterId === DAMAGE_CONTROL_MASTER_ID) {
        hasDamageControl = true;
      }
    };

    for (const slotUid of ship.slots) {
      checkSlot(slotUid);
    }
    checkSlot(ship.exSlot);

    return { hasDamageControl, hasGoddess };
  }

  // ==================== 战斗状态管理 ====================

  /**
   * 更新战斗状态快照 (战斗进行中)
   */
  updateBattleStatus(status: BattleStatusSnapshot): void {
    this.state.currentBattle = {
      ...this.state.currentBattle,
      status,
      result: null, // 清空之前的结果
      lastUpdatedAt: Date.now(),
    };
    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('battle');
  }

  /**
   * 更新战斗结果快照 (战斗结束后)
   */
  updateBattleResult(result: BattleResultSnapshot): void {
    this.state.currentBattle = {
      ...this.state.currentBattle,
      result,
      lastUpdatedAt: Date.now(),
    };
    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('battle');
  }

  /**
   * 清空当前战斗状态
   */
  clearBattleState(): void {
    this.state.currentBattle = {
      status: null,
      result: null,
      lastUpdatedAt: Date.now(),
    };
    this.state.lastUpdatedAt = Date.now();
    this.notifyListeners('battle');
  }

  /**
   * 获取当前战斗状态
   */
  getCurrentBattle(): CurrentBattleState {
    return this.state.currentBattle;
  }

  /**
   * 获取战斗状态快照
   */
  getBattleStatus(): BattleStatusSnapshot | null {
    return this.state.currentBattle.status;
  }

  /**
   * 获取战斗结果快照
   */
  getBattleResult(): BattleResultSnapshot | null {
    return this.state.currentBattle.result;
  }

  /**
   * 检查是否在战斗中
   */
  isInBattle(): boolean {
    return this.state.currentBattle.status !== null &&
      this.state.currentBattle.result === null;
  }

  /**
   * 检查是否有战斗结果待显示
   */
  hasBattleResult(): boolean {
    return this.state.currentBattle.result !== null;
  }

  /**
   * 导出状态快照（用于调试/持久化）
   */
  exportSnapshot(): object {
    return {
      admiral: this.state.admiral,
      materials: this.state.materials,
      decks: this.state.decks,
      Ndocks: this.state.Ndocks,
      Kdocks: this.state.Kdocks,
      quests: this.state.quests,
      ships: Array.from(this.state.ships.values()),
      currentBattle: this.state.currentBattle,
      lastUpdatedAt: this.state.lastUpdatedAt,
      expHistory: this.expHistory,
      dailySenkaStart: this.dailySenkaStart,
      rankingSnapshot: this.rankingSnapshot,
    };
  }
}

// ==================== 单例导出 ====================

const gameStateManager = new GameStateManager();

export function getGameState(): GameStateManager {
  return gameStateManager;
}

// 便捷函数
export const updateShipMasterMeta = (items: ReadonlyArray<{ id: number; name: string; fuelMax: number; ammoMax: number }>) =>
  gameStateManager.updateShipMasterMeta(items);
export const updateSlotItemEquipTypes = (items: ReadonlyArray<{ id: number; equipType: number; iconType: number }>) =>
  gameStateManager.updateSlotItemEquipTypes(items);
export const updateSlotItemIndex = (items: ReadonlyArray<{ uid: number; masterId: number }>) =>
  gameStateManager.updateSlotItemIndex(items);
export const getShipSpecialEquip = (uid: number) => gameStateManager.getShipSpecialEquip(uid);
export const getShipMasterName = (masterId: number) => gameStateManager.getShipMasterName(masterId);

export const updateAdmiral = (admiral: Admiral) => gameStateManager.updateAdmiral(admiral);
export const updateMaterials = (materials: Materials) => gameStateManager.updateMaterials(materials);
export const updateNdocks = (ndocks:Ndock[]) => gameStateManager.updateNDocks(ndocks);
export const updateKdocks = (kdocks:Kdock[]) => gameStateManager.updateKDocks(kdocks);
export const updateDecks = (decks: Deck[]) => gameStateManager.updateDecks(decks);
export const updateQuests = (quests: Quest[]) => gameStateManager.updateQuests(quests);
export const updateShips = (ships: Ship[]) => gameStateManager.updateShips(ships);
export const updateFromPort = (data: Parameters<GameStateManager['updateFromPort']>[0]) =>
gameStateManager.updateFromPort(data);

export const getAdmiral = () => gameStateManager.getAdmiral();
export const getMaterials = () => gameStateManager.getMaterials();
export const getNDocks = ()=> gameStateManager.getNDocks();
export const getKDocks = ()=> gameStateManager.getKDocks();
export const getDecks = () => gameStateManager.getDecks();
export const getDeck = (deckId: number) => gameStateManager.getDeck(deckId);
export const getQuests = () => gameStateManager.getQuests();
export const getShip = (uid: number) => gameStateManager.getShip(uid);
export const getDeckShips = (deckId: number) => gameStateManager.getDeckShips(deckId);
export const getDeckTaihaShips = (deckId: number) => gameStateManager.getDeckTaihaShips(deckId);
export const hasTaihaInDeck = (deckId: number) => gameStateManager.hasTaihaInDeck(deckId);
export const getSenkaInfo = () => gameStateManager.getSenkaInfo();
export const getRecentExpChanges = (count?: number) => gameStateManager.getRecentExpChanges(count);
export const resetDailySenka = () => gameStateManager.resetDailySenka();
export const updateRanking = (snapshot: RankingSnapshot) => gameStateManager.updateRanking(snapshot);
export const getRankingSnapshot = () => gameStateManager.getRankingSnapshot();
export const initDailySenka = (exp: number, time: number, date: string) => gameStateManager.initDailySenka(exp, time, date);
export const initRanking = (snapshot: RankingSnapshot) => gameStateManager.initRanking(snapshot);
export const clearGameState = () => gameStateManager.clear();
export const subscribeGameState = (listener: StateChangeListener) => gameStateManager.subscribe(listener);
export const exportGameStateSnapshot = () => gameStateManager.exportSnapshot();

// 战斗状态便捷函数
export const updateBattleStatus = (status: BattleStatusSnapshot) => gameStateManager.updateBattleStatus(status);
export const updateBattleResult = (result: BattleResultSnapshot) => gameStateManager.updateBattleResult(result);
export const clearBattleState = () => gameStateManager.clearBattleState();
export const getCurrentBattle = () => gameStateManager.getCurrentBattle();
export const getBattleStatus = () => gameStateManager.getBattleStatus();
export const getBattleResult = () => gameStateManager.getBattleResult();
export const isInBattle = () => gameStateManager.isInBattle();
export const hasBattleResult = () => gameStateManager.hasBattleResult();
