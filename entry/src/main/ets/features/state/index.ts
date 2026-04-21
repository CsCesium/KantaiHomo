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
  RankingSnapshot,
  NDockSnapShot,
  KDockSnapShot,
  CurrentBattleState,
  BattleStatusSnapshot,
  BattleResultSnapshot,
  FleetBattleStatus,
  ShipBattleStatus,
  EnemyBattleStatus,
  QuestSnapshot,
  MapGaugeSnapshot
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
  updateQuests,
  updateShips,
  updateFromPort,

  // 派生数据缓存更新
  updateShipMasterMeta,
  updateSlotItemEquipTypes,
  updateSlotItemIndex,
  updateShipGraphFilenames,
  setGameServerUrl,

  // 图像数据查询
  getShipGraphFilename,
  getGameServerUrl,

  // 查询方法
  getAdmiral,
  getMaterials,
  getNDocks,
  getKDocks,
  getDecks,
  getDeck,
  getQuests,
  getShip,
  getDeckShips,
  getDeckTaihaShips,
  hasTaihaInDeck,
  getShipSpecialEquip,
  getShipMasterName,

  // 战果计算
  getSenkaInfo,
  getRecentExpChanges,
  resetDailySenka,
  updateRanking,
  getRankingSnapshot,
  initDailySenka,
  initRanking,

  // 订阅
  subscribeGameState,

  // 战斗状态查询
  getCurrentBattle,
  getBattleStatus,
  getBattleResult,
  isInBattle,
  hasBattleResult,

  // 战斗状态更新
  updateBattleStatus,
  updateBattleResult,
  clearBattleState,

  // 工具
  clearGameState,
  exportGameStateSnapshot,

  // 地图血量
  updateMapGauges,
  getMapGauges,
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
