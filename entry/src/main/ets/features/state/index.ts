/**
 * State 模块入口
 */

// ========== 类型导出 ==========

export type {
  AdmiralSnapshot,
  MaterialsSnapshot,
  DeckSnapshot,
  ShipState,
  GameState,
  StateChangeType,
  StateChangeListener,
  ExpChange,
  SenkaInfo,
} from './type';

// ========== GameState 导出 ==========

export {
  // 核心
  getGameState,

  // 更新方法
  updateAdmiral,
  updateMaterials,
  updateDecks,
  updateShips,
  updateFromPort,

  // 查询方法
  getAdmiral,
  getMaterials,
  getDecks,
  getDeck,
  getShip,
  getDeckShips,
  getDeckTaihaShips,
  hasTaihaInDeck,

  // 战果计算
  getSenkaInfo,
  getRecentExpChanges,
  resetDailySenka,

  // 订阅
  subscribeGameState,

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
