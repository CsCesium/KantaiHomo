/**
 * features/battle/index.ts
 *
 * 战斗预测模块公共 API
 */

// 核心类型
export type {
  SimPrediction,
  FleetInput,
  RawFleetShip,
  MasterDataProvider,
  ShipMasterEntry,
  SlotItemMasterEntry,
} from './type';

export {
  StageType,
  AttackType,
  HitType,
  ShipOwner,
  Rank,
  AirControl,
  Formation,
  Engagement,
  Detection,
  MultiTargetAttackType,
  AirControlMap,
  DetectionMap,
  FormationMap,
  EngagementMap,
  BattleRankMap,
  SimShip,
  SimAttack,
  SimStage,
  SimResult,
  AerialInfo,
  EngagementInfo,
} from './type';

// 核心 Simulator
export { BattleSimulator } from './core';

// Fleet 构建工具
export {
  buildNormalFleetInput,
  buildCombinedFleetInput,
  buildFleetInputFromApiPacket,
} from './fleet_builder';
export type { ShipStateLike, DeckSnapshotLike } from './fleet_builder';

// Service（生命周期管理）
export {
  BATTLE_PREDICTION_KEY,
  BattlePredictionService,
  initBattlePredictionService,
  getBattlePredictionService,
} from './battle_prediction_service';
export type {
  BattlePredictionSnapshot,
  ShipHPSnapshot,
  GameStateFacade,
} from './battle_prediction_service';

// GameState 适配器
export { gameStateAdapter } from './state_adapter';
