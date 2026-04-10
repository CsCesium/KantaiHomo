/**
 * State 模块入口
 */

// ========== 类型导出 ==========

export type {
  AdmiralSnapshot,
  MaterialsSnapshot,
  DeckSnapshot,
  ShipState,
  ShipSpecialEquip,
  GameState,
  StateChangeType,
  StateChangeListener,
  ExpChange,
  SenkaInfo,
  NDockSnapShot,
  KDockSnapShot,
  CurrentBattleState,
  BattleStatusSnapshot,
  BattleResultSnapshot,
  FleetBattleStatus,
  ShipBattleStatus,
} from './type';

// ========== GameState 导出 ==========

export {
  // 核心
  getGameState,

  // 更新方法
  updateAdmiral,
  updateMaterials,
  updateNdocks,
  updateKdocks,
  updateDecks,
  updateShips,
  updateFromPort,

  // 派生数据缓存更新
  updateShipMasterMeta,
  updateSlotItemEquipTypes,
  updateSlotItemIndex,

  // 查询方法
  getAdmiral,
  getMaterials,
  getNDocks,
  getKDocks,
  getDecks,
  getDeck,
  getShip,
  getDeckShips,
  getDeckTaihaShips,
  hasTaihaInDeck,
  getShipSpecialEquip,

  // 战果计算
  getSenkaInfo,
  getRecentExpChanges,
  resetDailySenka,

  // 订阅
  subscribeGameState,

  // 战斗状态查询
  getCurrentBattle,
  getBattleStatus,
  getBattleResult,
  isInBattle,
  hasBattleResult,

  // 工具
  clearGameState,
  exportGameStateSnapshot,
} from './game_state';

// ========== State Extractor 导出 ==========

export type { ExtractResult } from './extractor';

export {
  extractAndUpdateState,
  hasStateFields,
  extractFromPort,
  extractFromShipApi,
  extractFromDeckApi,
  extractFromMaterialApi,
  updateSingleShip,
  updateMultipleShips,
} from './extractor';
