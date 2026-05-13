/**
 * Bridge functions converting BattlePredictionService snapshots into
 * domain-layer BattlePrediction objects, plus a HP-only fallback for when
 * the simulator is unavailable.
 *
 * These live here (not in the parser module) so the main-thread handler
 * can also call them — the simulator state lives on whichever thread runs
 * onBattlePacket, and ingestDump may parse large dumps in a TaskPool
 * worker.  The handler is the only point guaranteed to run on the main
 * thread, so it must own the simulator feed and snapshot conversion.
 */

import type { BattlePredictionSnapshot, ShipHPSnapshot } from './battle_prediction_service';
import type {
  BattlePrediction,
  BattleSegment,
  ShipPrediction,
} from '../../domain/models';

/**
 * 把 simulator 给出的 BattlePredictionSnapshot 转成领域层 BattlePrediction。
 * friendShips / friendEscortShips 来自出击上下文，用于填 uid/name；缺省时
 * uid=0/name='' 由后续 enrichPredictionWithShipInfo 兜底。
 */
export function simSnapshotToDomainPrediction(
  snap: BattlePredictionSnapshot,
  friendShips?: { uid: number; name: string }[],
  friendEscortShips?: { uid: number; name: string }[],
): BattlePrediction {
  function toShipPred(
    s: ShipHPSnapshot,
    ships: { uid: number; name: string }[] | undefined,
    posOffset: number,
  ): ShipPrediction {
    const hpAfter = Math.max(0, s.nowHP);
    const damageReceived = Math.max(0, s.initHP - hpAfter);
    const idx = s.pos - posOffset;
    return {
      uid:            ships?.[idx]?.uid  ?? 0,
      name:           ships?.[idx]?.name ?? '',
      hpBefore:       s.initHP,
      hpAfter,
      hpMax:          s.maxHP,
      damageReceived,
      damageTaken:    s.maxHP > 0 ? Math.round((1 - hpAfter / s.maxHP) * 100) : 0,
      isSunk:         s.isSunk,
      isTaiha:        s.isTaiha,
      isChuuha:       s.isChuuha,
      isShouha:       s.isShouha,
    };
  }

  const friendMain   = snap.mainFleet.map(s => toShipPred(s, friendShips, 0));
  const friendEscort = snap.escortFleet.length > 0
    ? snap.escortFleet.map(s => toShipPred(s, friendEscortShips, 6))
    : undefined;
  const enemyMain    = snap.enemyFleet.map(s => toShipPred(s, undefined, 0));
  const enemyEscort  = snap.enemyEscort.length > 0
    ? snap.enemyEscort.map(s => toShipPred(s, undefined, 0))
    : undefined;

  const friendSunkCount  = friendMain.filter(s => s.isSunk).length  + (friendEscort?.filter(s => s.isSunk).length  ?? 0);
  const friendTaihaCount = friendMain.filter(s => s.isTaiha).length + (friendEscort?.filter(s => s.isTaiha).length ?? 0);
  const enemySunkCount   = enemyMain.filter(s => s.isSunk).length   + (enemyEscort?.filter(s => s.isSunk).length   ?? 0);

  return {
    friendMain,
    friendEscort,
    enemyMain,
    enemyEscort,
    predictedRank:   snap.rank,
    friendSunkCount,
    friendTaihaCount,
    enemySunkCount,
    hasTaihaFriend:  friendTaihaCount > 0,
    hasSunkFriend:   friendSunkCount  > 0,
    calculatedAt:    snap.updatedAt,
  };
}

/**
 * Simulator 未就绪时的占位预测：使用战斗开始前的 HP，不计算伤害。
 * 仅作为数据缺失时的安全占位，不应被 UI 当作真实结算结果展示。
 */
export function buildFallbackPrediction(segment: BattleSegment): BattlePrediction {
  function fromFleet(fleet: { now: number[]; max: number[] } | undefined): ShipPrediction[] {
    if (!fleet) return [];
    return fleet.now
      .map((hp, i) => ({ hp, max: fleet.max[i] ?? 0 }))
      .filter(({ max }) => max > 0)
      .map(({ hp, max }) => ({
        uid: 0, name: '',
        hpBefore: hp, hpAfter: hp, hpMax: max,
        damageReceived: 0, damageTaken: 0,
        isSunk: false, isTaiha: false, isChuuha: false, isShouha: false,
      }));
  }
  return {
    friendMain:      fromFleet(segment.start.friend.main),
    friendEscort:    segment.start.friend.escort ? fromFleet(segment.start.friend.escort) : undefined,
    enemyMain:       fromFleet(segment.start.enemy.main),
    enemyEscort:     segment.start.enemy.escort  ? fromFleet(segment.start.enemy.escort)  : undefined,
    predictedRank:   'D',
    friendSunkCount: 0, friendTaihaCount: 0, enemySunkCount: 0,
    hasTaihaFriend:  false, hasSunkFriend: false,
    calculatedAt:    Date.now(),
  };
}
