import { AnyBattleEvt, BattleDayPayload, BattleNightPayload, BattleResultPayload } from '../../../domain/events/battle';
import {
  BattleSegment,
  mergeBattleSegments,
  BattleRecord,
  generateBattleId,
  battleRecordToRow
} from '../../../domain/models';
import { getSortieContext, enrichPredictionWithShipInfo, checkTaihaAdvanceRisk } from '../../../domain/service';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class BattleHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyBattleEvt;

    if(!deps.repos?.battle&&!deps.repos?.sortie){
      console.warn('[persist][BATTLE] repository not provided');
      return;
    }

    switch (e.type){
      case 'BATTLE_DAY':
        await this.handleDayBattle(e.payload,deps);
        break;
      case 'BATTLE_NIGHT':
        await this.handleNightBattle(e.payload,deps);
        break;
      case 'BATTLE_RESULT':
        await this.handleBattleResult(e.payload,deps);
        break;
    }
  }

  private async handleDayBattle(
    payload: BattleDayPayload,
    deps: PersistDeps
  ): Promise<void> {
    const { apiPath, segment, isPractice } = payload;
    let { prediction } = payload;

    // 1. 获取出击上下文，更新内存状态
    const context = getSortieContext();
    if (context) {
      // 用舰船信息丰富预测
      prediction = enrichPredictionWithShipInfo(
        prediction,
        context.fleetSnapshot.ships.map(s => ({ uid: s.uid, name: s.name })),
        context.fleetSnapshotEscort?.ships.map(s => ({ uid: s.uid, name: s.name }))
      );

      // 更新战斗上下文
      if (context.pendingBattle) {
        context.pendingBattle.daySegment = segment;
        context.pendingBattle.merged = segment;
        context.pendingBattle.prediction = prediction;
        context.pendingBattle.isPractice = isPractice;
      }
    }

    // 2. 检查大破风险
    const taihaRisk = checkTaihaAdvanceRisk(prediction);

    // 3. 发布事件通知 UI
    if (deps.publish) {
      deps.publish('battle:predicted', {
        prediction,
        apiPath,
        kind: 'day',
        hasTaiha: taihaRisk.hasRisk,
        taihaShips: taihaRisk.ships,
      });

      if (taihaRisk.hasRisk) {
        deps.publish('battle:taiha_warning', {
          ships: taihaRisk.ships,
        });
      }
    }

    console.info('[battle] day battle processed, predicted rank:', prediction.predictedRank);
  }

  /**
   * 处理夜战
   */
  private async handleNightBattle(
    payload: BattleNightPayload,
    deps: PersistDeps
  ): Promise<void> {
    const { apiPath, segment, isPractice } = payload;
    let { prediction } = payload;

    // 1. 获取出击上下文
    const context = getSortieContext();

    // 2. 合并昼夜战
    let merged: BattleSegment;
    if (context?.pendingBattle?.daySegment) {
      merged = mergeBattleSegments(context.pendingBattle.daySegment, segment);
    } else {
      merged = segment;
    }

    // 3. 更新内存状态
    if (context) {
      prediction = enrichPredictionWithShipInfo(
        prediction,
        context.fleetSnapshot.ships.map(s => ({ uid: s.uid, name: s.name })),
        context.fleetSnapshotEscort?.ships.map(s => ({ uid: s.uid, name: s.name }))
      );

      if (context.pendingBattle) {
        context.pendingBattle.nightSegment = segment;
        context.pendingBattle.merged = merged;
        context.pendingBattle.prediction = prediction;
        context.pendingBattle.isPractice = isPractice;
      }
    }

    // 4. 检查大破风险
    const taihaRisk = checkTaihaAdvanceRisk(prediction);

    // 5. 发布事件
    if (deps.publish) {
      deps.publish('battle:predicted', {
        prediction,
        apiPath,
        kind: 'night',
        hasTaiha: taihaRisk.hasRisk,
        taihaShips: taihaRisk.ships,
      });

      if (taihaRisk.hasRisk) {
        deps.publish('battle:taiha_warning', {
          ships: taihaRisk.ships,
        });
      }
    }

    console.info('[battle] night battle processed, predicted rank:', prediction.predictedRank);
  }

  /**
   * 处理战斗结果
   */
  private async handleBattleResult(
    payload: BattleResultPayload,
    deps: PersistDeps
  ): Promise<void> {
    const { isPractice, result: normalizedResult } = payload;

    // 1. 获取出击上下文
    const context = getSortieContext();

    // 2. 构建战斗记录
    const now = Date.now();
    const record: BattleRecord = {
      id: generateBattleId(),
      sortieId: context?.sortieId ?? '',

      // 点位信息
      mapAreaId: context?.mapAreaId ?? 0,
      mapInfoNo: context?.mapInfoNo ?? 0,
      cellId: context?.currentCell?.cellId ?? 0,
      cellEventId: context?.currentCell?.eventId ?? 0,
      isBoss: context?.currentCell?.isBoss ?? false,

      // 类型
      battleType: this.determineBattleType(context),
      isPractice,

      // 阵型
      friendFormation: context?.pendingBattle?.merged?.meta.formation?.friend,
      enemyFormation: context?.pendingBattle?.merged?.meta.formation?.enemy,
      engagement: context?.pendingBattle?.merged?.meta.formation?.engagement,

      // 舰队快照
      friendFleet: context?.fleetSnapshot ?? { deckId: 0, name: '', ships: [], capturedAt: 0 },
      friendFleetEscort: context?.fleetSnapshotEscort,

      // 敌方信息
      enemyFleet: context?.pendingBattle?.enemyFleet ?? { shipIds: [], levels: [], hpNow: [], hpMax: [] },
      enemyFleetEscort: context?.pendingBattle?.enemyFleetEscort,

      // 基地航空队
      airBases: context?.airBases,

      // HP
      hpStart: context?.pendingBattle?.merged?.start ?? { friend: { main: { now: [], max: [] } }, enemy: { main: { now: [], max: [] } } },
      hpEnd: context?.pendingBattle?.merged?.end ?? { friend: { main: { now: [], max: [] } }, enemy: { main: { now: [], max: [] } } },

      // 结果
      rank: normalizedResult.rank,
      mvp: normalizedResult.mvp.main,
      mvpCombined: normalizedResult.mvp.combined,

      // 掉落
      dropShipId: normalizedResult.drop?.shipId,
      dropShipName: normalizedResult.drop?.shipName,
      dropItemId: normalizedResult.drop?.itemId,

      // 经验
      baseExp: normalizedResult.exp.base,

      // 时间
      startedAt: context?.pendingBattle?.startedAt ?? now,
      endedAt: now,
    };

    // 3. 持久化（非演习才存储）
    if (!isPractice && deps.repos?.battle) {
      try {
        const row = battleRecordToRow(record);
        await deps.repos.battle.insert(row);
        console.info('[battle] record saved:', record.id, 'rank:', record.rank);
      } catch (e) {
        console.error('[battle] save failed:', String(e));
      }
    }

    // 4. 发布事件
    if (deps.publish) {
      deps.publish('battle:ended', {
        record,
        normalizedResult,
      });
    }

    // 5. 清理战斗上下文
    if (context) {
      context.pendingBattle = null;
    }

    console.info('[battle] result processed, rank:', record.rank, 'drop:', record.dropShipName ?? 'none');
  }

  private determineBattleType(context: ReturnType<typeof getSortieContext>): 'normal' | 'combined_ctf' | 'combined_stf' | 'combined_tcf' | 'practice' | 'air_raid' {
    if (!context) return 'normal';
    if (context.pendingBattle?.isPractice) return 'practice';
    if (context.pendingBattle?.isAirRaid) return 'air_raid';

    switch (context.combinedType) {
      case 1: return 'combined_ctf';
      case 2: return 'combined_stf';
      case 3: return 'combined_tcf';
      default: return 'normal';
    }
  }
}

const handler = new BattleHandler();

registerHandler('BATTLE_DAY', handler);
registerHandler('BATTLE_NIGHT', handler);
registerHandler('BATTLE_RESULT', handler);
