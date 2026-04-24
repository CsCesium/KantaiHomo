/**
 * features/battle/service/battle_prediction_service.ts
 *
 * BattlePredictionService
 *
 * 职责：
 *  1. 监听战斗 API 包（由 Router/webDump 层派发）
 *  2. 在首个战斗包到来时用当前 GameState 初始化 BattleSimulator
 *  3. 逐包 feed 给 simulator
 *  4. 将 BattlePrediction 写入 AppStorage，供 UI 组件通过 @StorageProp 响应式读取
 *
 * 使用方式（在 EntryAbility 或 WebHostController 中）：
 * ```ts
 * import { battlePredictionService } from '../features/battle';
 * battlePredictionService.onBattlePacket(apiPath, responseBody);
 * battlePredictionService.onBattleResult(apiPath, responseBody);
 * ```
 *
 * UI 组件：
 * ```ts
 * @StorageProp('battlePrediction') prediction: BattlePredictionSnapshot | null = null;
 * ```
 */

import { BattleSimulator, SimulatorOpts } from '../simulator/core';
import { BattlePrediction, Rank, SimResult, SimShip, SimStage } from '../simulator/type';
import {
  buildFleetInputFromApiPacket,
  DeckSnapshotLike,
  ShipStateLike,
} from '../simulator/fleet_builder';

// ─── AppStorage key ───────────────────────────────────────────────────────────

export const BATTLE_PREDICTION_KEY = 'battlePrediction';

// ─── Snapshot（可序列化，写入 AppStorage）──────────────────────────────────────

/** HP 状态快照（用于 UI 展示） */
export interface ShipHPSnapshot {
  shipId:  number;
  pos:     number;
  maxHP:   number;
  nowHP:   number;
  initHP:  number;
  /** 是否大破 */
  isTaiha: boolean;
  /** 是否中破 */
  isChuha: boolean;
  /** 是否小破 */
  isShipa: boolean;
  /** 是否击沉 */
  isSunk:  boolean;
}

export interface BattlePredictionSnapshot {
  /** 预测战斗结果等级 */
  rank:        Rank;
  /** MVP index（主力/护卫）  */
  mvp:         [number, number];
  /** 我方主力舰队 HP 快照 */
  mainFleet:   ShipHPSnapshot[];
  /** 我方护卫舰队 HP 快照 */
  escortFleet: ShipHPSnapshot[];
  /** 敌主力舰队 HP 快照 */
  enemyFleet:  ShipHPSnapshot[];
  /** 敌护卫舰队 HP 快照 */
  enemyEscort: ShipHPSnapshot[];
  /** 是否已有 battleresult（true=实际结果，false=推算） */
  isActual:    boolean;
  updatedAt:   number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toHPSnapshot(ships: (SimShip | null)[] | null | undefined): ShipHPSnapshot[] {
  //
  // return (ships ?? [])
  //   .filter((s): s is SimShip => s != null)
  //   .map(s => {
  //     const nowHP = Math.max(0, s.nowHP);
  //     return {
  //       shipId:  s.id,
  //       pos:     s.pos,
  //       maxHP:   s.maxHP,
  //       nowHP,
  //       initHP:  s.initHP,
  //       isTaiha: nowHP > 0 && nowHP * 4 <= s.maxHP,
  //       isChuha: nowHP > 0 && nowHP * 4 > s.maxHP && nowHP * 2 <= s.maxHP,
  //       isShipa: nowHP > 0 && nowHP * 2 > s.maxHP && nowHP * 4 <= s.maxHP * 3,
  //       isSunk:  nowHP <= 0,
  //     };
  //   });
  return (ships ?? new Array<SimShip | null>())
    .reduce((arr:ShipHPSnapshot[],s:SimShip|null):ShipHPSnapshot[]=>{
      if (s === null) return arr;
      const nowHP = Math.max(0, s.nowHP);
      arr.push(
        {
                shipId:  s.id,
                pos:     s.pos,
                maxHP:   s.maxHP,
                nowHP,
                initHP:  s.initHP,
                isTaiha: nowHP > 0 && nowHP * 4 <= s.maxHP,
                isChuha: nowHP > 0 && nowHP * 4 > s.maxHP && nowHP * 2 <= s.maxHP,
                isShipa: nowHP > 0 && nowHP * 2 > s.maxHP && nowHP * 4 <= s.maxHP * 3,
                isSunk:  nowHP <= 0,
              }
      );
      return arr;
    }, new Array<ShipHPSnapshot>())
}

/** 从 battle API response body（svdata= 格式或已解析对象）中提取 api_deck_id */
function extractDeckId(body: unknown): number {
  if (typeof body === 'object' && body != null) {
    const b = body as Record<string, unknown>;
    if (typeof b.api_deck_id === 'number') return b.api_deck_id;
  }
  return 1;
}

const BATTLE_PATHS = new Set([
  '/kcsapi/api_req_practice/battle',
  '/kcsapi/api_req_sortie/battle',
  '/kcsapi/api_req_sortie/airbattle',
  '/kcsapi/api_req_sortie/ld_airbattle',
  '/kcsapi/api_req_sortie/ld_shooting',
  '/kcsapi/api_req_combined_battle/battle',
  '/kcsapi/api_req_combined_battle/battle_water',
  '/kcsapi/api_req_combined_battle/airbattle',
  '/kcsapi/api_req_combined_battle/ld_airbattle',
  '/kcsapi/api_req_combined_battle/ld_shooting',
  '/kcsapi/api_req_combined_battle/ec_battle',
  '/kcsapi/api_req_combined_battle/each_battle',
  '/kcsapi/api_req_combined_battle/each_battle_water',
  '/kcsapi/api_req_practice/midnight_battle',
  '/kcsapi/api_req_battle_midnight/battle',
  '/kcsapi/api_req_battle_midnight/sp_midnight',
  '/kcsapi/api_req_combined_battle/midnight_battle',
  '/kcsapi/api_req_combined_battle/sp_midnight',
  '/kcsapi/api_req_combined_battle/ec_midnight_battle',
  '/kcsapi/api_req_combined_battle/ec_night_to_day',
  '/kcsapi/api_req_practice/battle_result',
  '/kcsapi/api_req_sortie/battleresult',
  '/kcsapi/api_req_combined_battle/battleresult',
]);

const RESULT_PATHS = new Set([
  '/kcsapi/api_req_practice/battle_result',
  '/kcsapi/api_req_sortie/battleresult',
  '/kcsapi/api_req_combined_battle/battleresult',
]);

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * GameState 接口（按项目 features/state 导出对齐，鸭子类型避免循环依赖）
 */
export interface GameStateFacade {
  getDecks():             DeckSnapshotLike[];
  getShips():             Map<number, ShipStateLike>;
  getCombinedFleetType(): number;   // 0=通常, 1=机动, 2=水上, 3=输送
}

export class BattlePredictionService {
  private simulator:    BattleSimulator | null = null;
  private simOpts:      SimulatorOpts;
  private gameState:    GameStateFacade;

  constructor(gameState: GameStateFacade, simOpts: SimulatorOpts = {}) {
    this.gameState = gameState;
    this.simOpts   = simOpts;
  }

  /**
   * 接收一条战斗相关 API 包。
   * 由 webDump/Router 在识别到战斗路径时调用。
   *
   * @param apiPath  API 路径，例如 '/kcsapi/api_req_sortie/battle'
   * @param packet   已解析的 response body 对象（需已去掉 "svdata=" 前缀并 JSON.parse）
   *                 务必在 packet 上附加 _path 字段：packet._path = apiPath
   */
  onBattlePacket(apiPath: string, packet: Record<string, unknown>): void {
    if (!BATTLE_PATHS.has(apiPath)) return;

    // 为 simulator 注入路径（simulator 通过 packet._path 判断 API 类型）
    packet._path = apiPath;

    // 首包：初始化 simulator
    if (this.simulator == null && !RESULT_PATHS.has(apiPath)) {
      const deckId           = extractDeckId(packet);
      const combinedFleetType = this.gameState.getCombinedFleetType();
      const decks            = this.gameState.getDecks();
      const ships            = this.gameState.getShips();

      const fleetInput = buildFleetInputFromApiPacket({
        deckId,
        combinedFleetType,
        decks,
        ships,
      });

      if (fleetInput == null) {
        console.warn('[BattlePredictionService] Failed to build fleet input, skipping.');
        return;
      }

      this.simulator = new BattleSimulator(fleetInput, this.simOpts);
    }

    if (this.simulator == null) return;
    this.simulator.simulate(packet);
    this._publishSnapshot(RESULT_PATHS.has(apiPath));
  }

  /** 重置（进入港口 / 下一场战斗前调用） */
  reset(): void {
    this.simulator = null;
    AppStorage.setOrCreate<BattlePredictionSnapshot | null>(BATTLE_PREDICTION_KEY, null);
  }

  /** 当前预测快照（null 表示无战斗中） */
  getCurrentSnapshot(): BattlePredictionSnapshot | null {
    if (this.simulator == null) return null;
    return this._buildSnapshot(false);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private _publishSnapshot(isActual: boolean): void {
    if (this.simulator == null) return;
    const snap = this._buildSnapshot(isActual);
    AppStorage.setOrCreate<BattlePredictionSnapshot | null>(BATTLE_PREDICTION_KEY, snap);
  }

  private _buildSnapshot(isActual: boolean): BattlePredictionSnapshot {
    const pred   = this.simulator!.getPrediction();
    const result = pred.result;

    return {
      rank:        result.rank ?? 'D' as Rank,
      mvp:         result.mvp  ?? [-1, -1],
      mainFleet:   toHPSnapshot(pred.mainFleet),
      escortFleet: toHPSnapshot(pred.escortFleet),
      enemyFleet:  toHPSnapshot(pred.enemyFleet),
      enemyEscort: toHPSnapshot(pred.enemyEscort),
      isActual,
      updatedAt:   Date.now(),
    };
  }
}

// ─── 单例（按项目风格，可改为依赖注入）──────────────────────────────────────────

let _service: BattlePredictionService | null = null;

export function initBattlePredictionService(
  gameState: GameStateFacade,
  opts?:     SimulatorOpts,
): BattlePredictionService {
  _service = new BattlePredictionService(gameState, opts);
  return _service;
}

export function getBattlePredictionService(): BattlePredictionService {
  if (_service == null) {
    throw new Error('[BattlePredictionService] Not initialised. Call initBattlePredictionService() first.');
  }
  return _service;
}
