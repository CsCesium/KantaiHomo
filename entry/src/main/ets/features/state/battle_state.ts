import {
  ShipPrediction,
  FleetSnapshot,
  EnemyFleetInfo,
  SortieContext,
  BattleContext,
  BattlePrediction,
  generateBattleId
} from "../../domain/models";
import {
  ShipBattleStatus,
  FleetBattleStatus,
  EnemyBattleStatus,
  BattleStatusSnapshot,
  BattleResultSnapshot
} from "./type";


/**
 * 从 ShipPrediction 构建 ShipBattleStatus
 */
function buildShipBattleStatus(pred: ShipPrediction): ShipBattleStatus {
  const hpPercent = pred.hpMax > 0 ? Math.round((pred.hpAfter / pred.hpMax) * 100) : 0;

  return {
    uid: pred.uid,
    name: pred.name,
    hpBefore: pred.hpBefore,
    hpAfter: pred.hpAfter,
    hpMax: pred.hpMax,
    damageReceived: pred.damageReceived,
    hpPercent,
    isSunk: pred.isSunk,
    isTaiha: pred.isTaiha,
    isChuuha: pred.isChuuha,
    isShouha: pred.isShouha,
  };
}

/**
 * 从 FleetSnapshot 和预测数据构建 FleetBattleStatus
 */
function buildFleetBattleStatus(
  fleetSnapshot: FleetSnapshot,
  predictions: ShipPrediction[]
): FleetBattleStatus {
  const ships = predictions.map(buildShipBattleStatus);

  return {
    deckId: fleetSnapshot.deckId,
    name: fleetSnapshot.name,
    ships,
    taihaCount: ships.filter(s => s.isTaiha).length,
    sunkCount: ships.filter(s => s.isSunk).length,
  };
}

/**
 * 从敌方信息构建 EnemyBattleStatus
 */
function buildEnemyBattleStatus(
  enemyInfo: EnemyFleetInfo | undefined,
  predictions: ShipPrediction[]
): EnemyBattleStatus {
  if (!enemyInfo) {
    return {
      shipIds: [],
      hpBefore: [],
      hpNow: [],
      hpMax: [],
      sunkCount: 0,
    };
  }

  const hpBefore = predictions.map(p => p.hpBefore);
  const hpNow = predictions.map(p => p.hpAfter);
  const hpMax = predictions.map(p => p.hpMax);
  const sunkCount = predictions.filter(p => p.isSunk).length;

  return {
    shipIds: enemyInfo.shipIds,
    hpBefore,
    hpNow,
    hpMax,
    sunkCount,
  };
}

/**
 * 获取大破舰列表
 */
function getTaihaShips(predictions: ShipPrediction[]): { uid: number; name: string; hpPercent: number }[] {
  return predictions
    .filter(p => p.isTaiha && !p.isSunk)
    .map(p => ({
      uid: p.uid,
      name: p.name,
      hpPercent: Math.round((p.hpAfter / p.hpMax) * 100),
    }));
}

/**
 * 检查是否有击沉风险 (非旗舰)
 */
function hasSunkRiskNonFlagship(friendMain: ShipPrediction[], friendEscort?: ShipPrediction[]): boolean {
  // 主力舰队跳过旗舰(index 0)
  const mainRisk = friendMain.slice(1).some(p => p.isSunk);
  // 护卫舰队全部检查
  const escortRisk = friendEscort?.some(p => p.isSunk) ?? false;
  return mainRisk || escortRisk;
}

export interface BuildBattleStatusOptions {
  battleId?: string;
  sortieContext: SortieContext;
  battleContext: BattleContext;
  prediction: BattlePrediction;
  battlePhase: 'day' | 'night' | 'day_to_night';
}

/**
 * 构建战斗状态快照 (战斗进行中)
 */
export function buildBattleStatusSnapshot(options: BuildBattleStatusOptions): BattleStatusSnapshot {
  const { sortieContext, battleContext, prediction, battlePhase } = options;
  const battleId = options.battleId ?? generateBattleId();

  // 合并友军大破舰
  const allFriendPredictions = [
    ...prediction.friendMain,
    ...(prediction.friendEscort ?? []),
  ];
  const taihaShips = getTaihaShips(allFriendPredictions);

  const snapshot: BattleStatusSnapshot = {
    battleId,
    sortieId: sortieContext.sortieId,

    // 地图信息
    mapAreaId: sortieContext.mapAreaId,
    mapInfoNo: sortieContext.mapInfoNo,
    cellId: battleContext.cell.cellId,
    isBoss: battleContext.cell.isBoss ?? false,

    // 战斗类型
    battlePhase,
    isPractice: battleContext.isPractice,
    combinedType: sortieContext.combinedType,

    // 阵型
    friendFormation: battleContext.merged?.meta.formation?.friend,
    enemyFormation: battleContext.merged?.meta.formation?.enemy,
    engagement: battleContext.merged?.meta.formation?.engagement,

    // 友方舰队
    friendMain: buildFleetBattleStatus(sortieContext.fleetSnapshot, prediction.friendMain),
    friendEscort: sortieContext.fleetSnapshotEscort && prediction.friendEscort
      ? buildFleetBattleStatus(sortieContext.fleetSnapshotEscort, prediction.friendEscort)
      : undefined,

    // 敌方舰队
    enemyMain: buildEnemyBattleStatus(battleContext.enemyFleet, prediction.enemyMain),
    enemyEscort: battleContext.enemyFleetEscort && prediction.enemyEscort
      ? buildEnemyBattleStatus(battleContext.enemyFleetEscort, prediction.enemyEscort)
      : undefined,

    // 预测结果
    predictedRank: prediction.predictedRank,
    hasTaihaRisk: prediction.hasTaihaFriend,
    taihaShips,
    hasSunkRisk: hasSunkRiskNonFlagship(prediction.friendMain, prediction.friendEscort),

    // 航空状态 (from merged battle segment meta)
    airState: battleContext.merged?.meta.airState,
    friendPlaneNow: battleContext.merged?.meta.friendPlaneNow,
    friendPlaneMax: battleContext.merged?.meta.friendPlaneMax,
    aaciTriggered: false,

    // 时间戳
    startedAt: battleContext.startedAt,
    calculatedAt: prediction.calculatedAt,
  };

  return snapshot;
}

export interface BuildBattleResultOptions {
  battleId: string;
  sortieContext: SortieContext;
  battleContext: BattleContext;
  prediction: BattlePrediction;
  rank: string;
  mvp?: number;
  mvpCombined?: number;
  dropShipId?: number;
  dropShipName?: string;
  dropItemId?: number;
  baseExp?: number;
}

/**
 * 构建战斗结果快照 (战斗结束后)
 */
export function buildBattleResultSnapshot(options: BuildBattleResultOptions): BattleResultSnapshot {
  const {
    battleId,
    sortieContext,
    battleContext,
    prediction,
    rank,
    mvp,
    mvpCombined,
    dropShipId,
    dropShipName,
    dropItemId,
    baseExp,
  } = options;

  const now = Date.now();

  const snapshot: BattleResultSnapshot = {
    battleId,
    sortieId: sortieContext.sortieId,

    // 地图信息
    mapAreaId: sortieContext.mapAreaId,
    mapInfoNo: sortieContext.mapInfoNo,
    cellId: battleContext.cell.cellId,
    isBoss: battleContext.cell.isBoss ?? false,

    // 战斗结果
    rank,
    mvp,
    mvpCombined,

    // 掉落
    dropShipId,
    dropShipName,
    dropItemId,

    // 经验
    baseExp,

    // 舰队最终状态
    friendMain: buildFleetBattleStatus(sortieContext.fleetSnapshot, prediction.friendMain),
    friendEscort: sortieContext.fleetSnapshotEscort && prediction.friendEscort
      ? buildFleetBattleStatus(sortieContext.fleetSnapshotEscort, prediction.friendEscort)
      : undefined,
    enemyMain: buildEnemyBattleStatus(battleContext.enemyFleet, prediction.enemyMain),
    enemyEscort: battleContext.enemyFleetEscort && prediction.enemyEscort
      ? buildEnemyBattleStatus(battleContext.enemyFleetEscort, prediction.enemyEscort)
      : undefined,

    // 时间戳
    startedAt: battleContext.startedAt,
    endedAt: now,
  };

  return snapshot;
}

/**
 * 快速构建昼战状态快照
 */
export function buildDayBattleStatus(
  sortieContext: SortieContext,
  battleContext: BattleContext,
  prediction: BattlePrediction
): BattleStatusSnapshot {
  return buildBattleStatusSnapshot({
    sortieContext,
    battleContext,
    prediction,
    battlePhase: 'day',
  });
}

/**
 * 快速构建夜战状态快照
 */
export function buildNightBattleStatus(
  sortieContext: SortieContext,
  battleContext: BattleContext,
  prediction: BattlePrediction
): BattleStatusSnapshot {
  // 判断是昼夜战还是单独夜战
  const battlePhase = battleContext.daySegment ? 'day_to_night' : 'night';

  return buildBattleStatusSnapshot({
    sortieContext,
    battleContext,
    prediction,
    battlePhase,
  });
}
