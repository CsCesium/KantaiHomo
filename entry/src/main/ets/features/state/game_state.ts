
// ==================== 状态管理类 ====================
import { Admiral, Materials, Deck, Ship, Ndock, Kdock } from "../../domain/models";
import {
  GameState,
  StateChangeListener,
  ExpChange,
  AdmiralSnapshot,
  MaterialsSnapshot,
  DeckSnapshot,
  ShipState,
  SenkaInfo,
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

class GameStateManager {
  private state: GameState = {
    admiral: null,
    materials: null,
    decks: [],
    Ndocks:[],
    Kdocks:[],
    ships: new Map(),
    currentBattle: {
      status: null,
      result: null,
      lastUpdatedAt: 0,
    },
    lastUpdatedAt: 0,
  };

  private listeners: Set<StateChangeListener> = new Set();

  private expHistory: ExpChange[] = [];
  private readonly MAX_EXP_HISTORY = 100;

  /** 每日战果追踪 */
  private dailySenkaStart: { exp: number; time: number } | null = null;

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

    // 初始化每日战果追踪
    if (!this.dailySenkaStart) {
      this.dailySenkaStart = { exp: newExp, time: Date.now() };
    }

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

    this.state.ships.set(ship.uid, {
      uid: ship.uid,
      masterId: ship.masterId,
      level: ship.level,
      hpNow: ship.hpNow,
      hpMax: ship.hpMax,
      cond: ship.cond,
      fuel: ship.fuel,
      ammo: ship.ammo,
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
      if (!this.dailySenkaStart) {
        this.dailySenkaStart = { exp: data.admiral.experience, time: Date.now() };
      }
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
    if (!this.dailySenkaStart || !this.state.admiral) {
      return null;
    }

    const currentExp = this.state.admiral.experience;
    const todayExp = currentExp - this.dailySenkaStart.exp;

    return {
      todayExp,
      estimatedSenka: Math.floor(todayExp / 1428),
      startTime: this.dailySenkaStart.time,
      startExp: this.dailySenkaStart.exp,
    };
  }

  /**
   * 获取最近的经验变化
   */
  getRecentExpChanges(count = 10): ExpChange[] {
    return this.expHistory.slice(-count);
  }

  /**
   * 重置每日战果追踪（跨日时调用）
   */
  resetDailySenka(): void {
    if (this.state.admiral) {
      this.dailySenkaStart = {
        exp: this.state.admiral.experience,
        time: Date.now(),
      };
    }
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
      ships: new Map(),
      currentBattle: {
        status: null,
        result: null,
        lastUpdatedAt: 0,
      },
      lastUpdatedAt: 0,
    };
    this.expHistory = [];
    this.dailySenkaStart = null;
    this.notifyListeners('all');
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
      ships: Array.from(this.state.ships.values()),
      currentBattle: this.state.currentBattle,
      lastUpdatedAt: this.state.lastUpdatedAt,
      expHistory: this.expHistory,
      dailySenkaStart: this.dailySenkaStart,
    };
  }
}

// ==================== 单例导出 ====================

const gameStateManager = new GameStateManager();

export function getGameState(): GameStateManager {
  return gameStateManager;
}

// 便捷函数
export const updateAdmiral = (admiral: Admiral) => gameStateManager.updateAdmiral(admiral);
export const updateMaterials = (materials: Materials) => gameStateManager.updateMaterials(materials);
export const updateNdocks = (ndocks:Ndock[]) => gameStateManager.updateNDocks(ndocks);
export const updateKdocks = (kdocks:Kdock[]) => gameStateManager.updateKDocks(kdocks);
export const updateDecks = (decks: Deck[]) => gameStateManager.updateDecks(decks);
export const updateShips = (ships: Ship[]) => gameStateManager.updateShips(ships);
export const updateFromPort = (data: Parameters<GameStateManager['updateFromPort']>[0]) =>
gameStateManager.updateFromPort(data);

export const getAdmiral = () => gameStateManager.getAdmiral();
export const getMaterials = () => gameStateManager.getMaterials();
export const getNDocks = ()=> gameStateManager.getNDocks();
export const getKDocks = ()=> gameStateManager.getKDocks();
export const getDecks = () => gameStateManager.getDecks();
export const getDeck = (deckId: number) => gameStateManager.getDeck(deckId);
export const getShip = (uid: number) => gameStateManager.getShip(uid);
export const getDeckShips = (deckId: number) => gameStateManager.getDeckShips(deckId);
export const getDeckTaihaShips = (deckId: number) => gameStateManager.getDeckTaihaShips(deckId);
export const hasTaihaInDeck = (deckId: number) => gameStateManager.hasTaihaInDeck(deckId);
export const getSenkaInfo = () => gameStateManager.getSenkaInfo();
export const getRecentExpChanges = (count?: number) => gameStateManager.getRecentExpChanges(count);
export const resetDailySenka = () => gameStateManager.resetDailySenka();
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
