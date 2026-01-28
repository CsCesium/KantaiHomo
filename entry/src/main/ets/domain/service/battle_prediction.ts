/**
 * Battle Prediction Service - 战斗预测
 * 根据 BattleSegment 计算预测结果
 */

import type { BattleSegment, BattleHpSnapshot, BattleHpFleet } from '../models/struct/battle';
import type { BattlePrediction, ShipPrediction } from '../models/struct/battle_record';

/**
 * 根据战斗段计算预测
 */
export function predictBattle(segment: BattleSegment): BattlePrediction {
  const { start, end } = segment;

  const friendMain = buildPredictions('friend', 'main', start, end);
  const friendEscort = start.friend.escort
    ? buildPredictions('friend', 'escort', start, end)
    : undefined;

  const enemyMain = buildPredictions('enemy', 'main', start, end);
  const enemyEscort = start.enemy.escort
    ? buildPredictions('enemy', 'escort', start, end)
    : undefined;

  // 统计
  const friendSunkCount = countSunk(friendMain) + (friendEscort ? countSunk(friendEscort) : 0);
  const friendTaihaCount = countTaiha(friendMain) + (friendEscort ? countTaiha(friendEscort) : 0);
  const enemySunkCount = countSunk(enemyMain) + (enemyEscort ? countSunk(enemyEscort) : 0);

  // 预测等级
  const predictedRank = predictRank(
    friendMain.length + (friendEscort?.length ?? 0),
    friendSunkCount,
    enemyMain.length + (enemyEscort?.length ?? 0),
    enemySunkCount,
    friendMain,
    enemyMain,
    friendEscort,
    enemyEscort
  );

  return {
    friendMain,
    friendEscort,
    enemyMain,
    enemyEscort,
    predictedRank,
    friendSunkCount,
    friendTaihaCount,
    enemySunkCount,
    hasTaihaFriend: friendTaihaCount > 0,
    hasSunkFriend: friendSunkCount > 0,
    calculatedAt: Date.now(),
  };
}

/**
 * 构建单个舰队的预测数组
 */
function buildPredictions(
  side: 'friend' | 'enemy',
  fleet: 'main' | 'escort',
  start: BattleHpSnapshot,
  end: BattleHpSnapshot
): ShipPrediction[] {
  const startFleet = getFleet(start, side, fleet);
  const endFleet = getFleet(end, side, fleet);

  if (!startFleet || !endFleet) return [];

  const predictions: ShipPrediction[] = [];
  const len = Math.min(startFleet.now.length, startFleet.max.length);

  for (let i = 0; i < len; i++) {
    const hpMax = startFleet.max[i] ?? 0;
    const hpBefore = startFleet.now[i] ?? 0;
    const hpAfter = endFleet.now[i] ?? 0;

    if (hpMax <= 0) continue;  // 跳过空槽

    const damageReceived = Math.max(0, hpBefore - hpAfter);
    const damageTaken = hpMax > 0 ? Math.round((1 - hpAfter / hpMax) * 100) : 0;

    predictions.push({
      uid: 0,  // 需要外部填充
      name: '',  // 需要外部填充
      hpBefore,
      hpAfter: Math.max(0, hpAfter),
      hpMax,
      damageReceived,
      damageTaken,
      isSunk: hpAfter <= 0,
      isTaiha: hpAfter > 0 && (hpAfter / hpMax) <= 0.25,
      isChuuha: hpAfter > 0 && (hpAfter / hpMax) <= 0.5 && (hpAfter / hpMax) > 0.25,
      isShouha: hpAfter > 0 && (hpAfter / hpMax) <= 0.75 && (hpAfter / hpMax) > 0.5,
    });
  }

  return predictions;
}

function getFleet(
  snapshot: BattleHpSnapshot,
  side: 'friend' | 'enemy',
  fleet: 'main' | 'escort'
): BattleHpFleet | undefined {
  const sideData = side === 'friend' ? snapshot.friend : snapshot.enemy;
  return fleet === 'main' ? sideData.main : sideData.escort;
}

function countSunk(predictions: ShipPrediction[]): number {
  return predictions.filter(p => p.isSunk).length;
}

function countTaiha(predictions: ShipPrediction[]): number {
  return predictions.filter(p => p.isTaiha).length;
}

/**
 * 预测战斗等级
 * 基于舰C的胜利判定逻辑
 */
function predictRank(
  friendTotal: number,
  friendSunk: number,
  enemyTotal: number,
  enemySunk: number,
  friendMain: ShipPrediction[],
  enemyMain: ShipPrediction[],
  friendEscort?: ShipPrediction[],
  enemyEscort?: ShipPrediction[]
): string {
  // 全灭判定
  if (friendSunk >= friendTotal && friendTotal > 0) {
    return 'E';  // 我方全灭
  }

  if (enemySunk >= enemyTotal && enemyTotal > 0) {
    // 敌方全灭
    if (friendSunk === 0) {
      return 'S';  // 完全胜利
    }
    return 'A';  // A胜利
  }

  // 计算伤害比例
  const friendDamageRatio = calculateDamageRatio([...friendMain, ...(friendEscort ?? [])]);
  const enemyDamageRatio = calculateDamageRatio([...enemyMain, ...(enemyEscort ?? [])]);

  // 旗舰击沉
  const enemyFlagshipSunk = enemyMain.length > 0 && enemyMain[0]?.isSunk;

  // 击沉过半
  const enemySunkOverHalf = enemySunk > enemyTotal / 2;

  // 敌方伤害 >= 2.5倍我方伤害
  const damageAdvantage = enemyDamageRatio >= friendDamageRatio * 2.5;

  if (enemyFlagshipSunk) {
    if (friendSunk === 0 && enemySunkOverHalf) {
      return 'A';
    }
    if (damageAdvantage) {
      return 'B';
    }
  }

  if (enemySunkOverHalf) {
    return 'B';
  }

  // 敌方旗舰大破
  const enemyFlagshipTaiha = enemyMain.length > 0 && enemyMain[0]?.isTaiha;
  if (enemyFlagshipTaiha) {
    return 'B';
  }

  // 伤害判定
  if (enemyDamageRatio > friendDamageRatio * 2.5) {
    return 'B';
  }
  if (enemyDamageRatio > friendDamageRatio * 0.9) {
    return 'C';
  }

  return 'D';
}

/**
 * 计算伤害比例 (总伤害 / 总最大HP)
 */
function calculateDamageRatio(predictions: ShipPrediction[]): number {
  let totalDamage = 0;
  let totalMaxHp = 0;

  for (const p of predictions) {
    if (p.hpMax > 0) {
      totalDamage += p.damageReceived;
      totalMaxHp += p.hpMax;
    }
  }

  return totalMaxHp > 0 ? totalDamage / totalMaxHp : 0;
}

/**
 * 检查是否有大破进击风险
 */
export function checkTaihaAdvanceRisk(prediction: BattlePrediction): {
  hasRisk: boolean;
  ships: { idx: number; name: string; hpPercent: number }[];
} {
  const riskyShips: { idx: number; name: string; hpPercent: number }[] = [];

  // 检查主力舰队 (跳过旗舰，旗舰不会击沉)
  for (let i = 1; i < prediction.friendMain.length; i++) {
    const ship = prediction.friendMain[i];
    if (ship && ship.isTaiha && !ship.isSunk) {
      riskyShips.push({
        idx: i,
        name: ship.name || `Ship #${i + 1}`,
        hpPercent: Math.round((ship.hpAfter / ship.hpMax) * 100),
      });
    }
  }

  // 检查护卫舰队
  if (prediction.friendEscort) {
    for (let i = 0; i < prediction.friendEscort.length; i++) {
      const ship = prediction.friendEscort[i];
      if (ship && ship.isTaiha && !ship.isSunk) {
        riskyShips.push({
          idx: i + 6,  // 护卫舰队从 6 开始
          name: ship.name || `Escort #${i + 1}`,
          hpPercent: Math.round((ship.hpAfter / ship.hpMax) * 100),
        });
      }
    }
  }

  return {
    hasRisk: riskyShips.length > 0,
    ships: riskyShips,
  };
}

/**
 * 用舰船信息填充预测
 */
export function enrichPredictionWithShipInfo(
  prediction: BattlePrediction,
  friendShips: { uid: number; name: string }[],
  friendEscortShips?: { uid: number; name: string }[]
): BattlePrediction {
  const enriched = { ...prediction };

  enriched.friendMain = prediction.friendMain.map((p, i) => ({
    ...p,
    uid: friendShips[i]?.uid ?? 0,
    name: friendShips[i]?.name ?? '',
  }));

  if (prediction.friendEscort && friendEscortShips) {
    enriched.friendEscort = prediction.friendEscort.map((p, i) => ({
      ...p,
      uid: friendEscortShips[i]?.uid ?? 0,
      name: friendEscortShips[i]?.name ?? '',
    }));
  }

  return enriched;
}
