import { AnyBattleEvt, BattleDayPayload, BattleNightPayload, BattleResultPayload } from '../../../domain/events/battle';
import {
  BattleSegment,
  mergeBattleSegments,
  BattleRecord,
  generateBattleId,
  battleRecordToRow,
  createBattleContext,
} from '../../../domain/models';
import { getSortieContext, enrichPredictionWithShipInfo, checkTaihaAdvanceRisk } from '../../../domain/service';
import { buildDayBattleStatus, buildNightBattleStatus, buildBattleResultSnapshot } from '../../state/battle_state';
import { updateBattleStatus, updateBattleResult, getShipSpecialEquip, patchShipsHp, isShipEscaped } from '../../state/game_state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';
import { publishAlert } from '../../alerts/bus';
import { setLastBattleHasTaihaRisk, setLastBattleTaihaShips } from '../../alerts/lastBattleState';
import type { BattleResultAlert } from '../../alerts/type';
import { getBattlePredictionService } from '../../simulator';


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
    const { apiPath, segment, isPractice, isAirRaid } = payload;
    let { prediction } = payload;

    // 1. 获取出击上下文，更新内存状态
    const context = getSortieContext();
    if (context) {
      // 用舰船信息丰富预测；基地空袭的 friend 一侧是基地，parser 已用 LBAS 名填好，
      // 此处跳过避免被舰队名覆盖。
      if (!isAirRaid) {
        prediction = enrichPredictionWithShipInfo(
          prediction,
          context.fleetSnapshot.ships.map(s => ({ uid: s.uid, name: s.name })),
          context.fleetSnapshotEscort?.ships.map(s => ({ uid: s.uid, name: s.name }))
        );
      }

      // 首节点战斗或基地空袭时 pendingBattle 为 null，按当前节点补建。
      if (!context.pendingBattle && context.currentCell) {
        context.pendingBattle = createBattleContext(
          context.currentCell,
          isPractice,
          context.combinedType > 0,
        );
      }

      // 更新战斗上下文
      if (context.pendingBattle) {
        context.pendingBattle.daySegment = segment;
        context.pendingBattle.merged = segment;
        context.pendingBattle.prediction = prediction;
        context.pendingBattle.isPractice = isPractice;
        if (isAirRaid) {
          context.pendingBattle.isAirRaid = true;
        }

        // 填充敌方舰队信息（供 UI 显示敌舰 ID）
        if (segment.enemyMain) {
          context.pendingBattle.enemyFleet = segment.enemyMain;
          context.pendingBattle.enemyFleetEscort = segment.enemyEscort;
        }

        // 更新战斗状态快照 (供前端显示)
        const battleStatus = buildDayBattleStatus(context, context.pendingBattle, prediction);
        updateBattleStatus(battleStatus);
      }
    }

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

      // 开幕夜战(sp_midnight)：当前点没有前置昼战，pendingBattle 仍为 null。
      // 与昼战同样按当前节点补建一次。
      if (!context.pendingBattle && context.currentCell) {
        context.pendingBattle = createBattleContext(
          context.currentCell,
          isPractice,
          context.combinedType > 0,
        );
      }

      if (context.pendingBattle) {
        context.pendingBattle.nightSegment = segment;
        context.pendingBattle.merged = merged;
        context.pendingBattle.prediction = prediction;
        context.pendingBattle.isPractice = isPractice;

        // 开幕夜战(sp_midnight)无前置昼战，pendingBattle.enemyFleet 此时仍未填充。
        // 即便普通夜战，刷新一次也能保证敌舰列表与最新 segment 一致。
        if (segment.enemyMain) {
          context.pendingBattle.enemyFleet = segment.enemyMain;
          context.pendingBattle.enemyFleetEscort = segment.enemyEscort;
        }

        // 更新战斗状态快照 (供前端显示)
        const battleStatus = buildNightBattleStatus(context, context.pendingBattle, prediction);
        updateBattleStatus(battleStatus);
      }
    }
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
    const battleId = generateBattleId();
    const record: BattleRecord = {
      id: battleId,
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

    // 3. 更新战斗结果状态快照 (供前端显示)
    if (context && context.pendingBattle && context.pendingBattle.prediction) {
      const resultSnapshot = buildBattleResultSnapshot({
        battleId,
        sortieContext: context,
        battleContext: context.pendingBattle,
        prediction: context.pendingBattle.prediction,
        rank: normalizedResult.rank,
        mvp: normalizedResult.mvp.main,
        mvpCombined: normalizedResult.mvp.combined,
        dropShipId: normalizedResult.drop?.shipId,
        dropShipName: normalizedResult.drop?.shipName,
        dropItemId: normalizedResult.drop?.itemId,
        baseExp: normalizedResult.exp.base,
      });
      updateBattleResult(resultSnapshot);
    }

    // 3b. 把战后 HP 写回 GameState.ships，使主面板与侧边栏在
    // 下一次 /api_port/port 之前就反映真实战后 HP（与侧边栏 BATTLE_RESULT
    // 覆盖逻辑保持一致）。BattleResult 响应不含 api_ship_data，
    // 故依赖战斗段（来自模拟器或包结算）的 hpEnd。
    if (context) {
      const hpPatches: { uid: number; hpNow: number; hpMax: number }[] = [];
      const mainShips = context.fleetSnapshot?.ships ?? [];
      const mainNow = record.hpEnd.friend.main.now;
      const mainMax = record.hpEnd.friend.main.max;
      for (let i = 0; i < mainShips.length && i < mainNow.length; i++) {
        const uid = mainShips[i].uid;
        if (!uid) continue;
        const hpMax = mainMax[i] > 0 ? mainMax[i] : mainShips[i].hpMax;
        hpPatches.push({ uid, hpNow: mainNow[i], hpMax });
      }
      if (context.combinedType > 0) {
        const escortShips = context.fleetSnapshotEscort?.ships ?? [];
        const escortNow = record.hpEnd.friend.escort?.now ?? [];
        const escortMax = record.hpEnd.friend.escort?.max ?? [];
        for (let i = 0; i < escortShips.length && i < escortNow.length; i++) {
          const uid = escortShips[i].uid;
          if (!uid) continue;
          const hpMax = escortMax[i] > 0 ? escortMax[i] : escortShips[i].hpMax;
          hpPatches.push({ uid, hpNow: escortNow[i], hpMax });
        }
      }
      if (hpPatches.length > 0) {
        patchShipsHp(hpPatches);
      }
    }

    // 4. 持久化（非演习才存储）
    if (!isPractice && deps.repos?.battle) {
      try {
        const row = battleRecordToRow(record);
        await deps.repos.battle.insert(row);
        console.info('[battle] record saved:', record.id, 'rank:', record.rank);
      } catch (e) {
        console.error('[battle] save failed:', String(e));
      }
    }
    // 5a. 战斗结算提醒
    try {
      // 计算大破无损管击沉风险（旗舰 i=0 不会击沉，从 i=1 开始）
      let hasTaihaRisk = false;
      const taihaShipsList: { uid: number; name: string; hpAfter: number; hpMax: number }[] = [];
      const prediction = context?.pendingBattle?.prediction;
      const mainPred = prediction?.friendMain ?? [];
      for (let i = 1; i < mainPred.length; i++) {
        const ship = mainPred[i];
        if (!ship || ship.hpMax <= 0 || ship.isSunk) continue;
        if (ship.hpAfter > 0 && ship.hpAfter / ship.hpMax <= 0.25) {
          const equip = getShipSpecialEquip(ship.uid);
          if (!equip.hasDamageControl && !equip.hasGoddess) {
            hasTaihaRisk = true;
            taihaShipsList.push({
              uid: ship.uid,
              name: ship.name || `#${ship.uid}`,
              hpAfter: ship.hpAfter,
              hpMax: ship.hpMax,
            });
          }
        }
      }
      // 联合舰队时检查护卫舰队
      if (context && context.combinedType > 0) {
        const escortPred = prediction?.friendEscort ?? [];
        for (let i = 1; i < escortPred.length; i++) {
          const ship = escortPred[i];
          if (!ship || ship.hpMax <= 0 || ship.isSunk) continue;
          if (ship.hpAfter > 0 && ship.hpAfter / ship.hpMax <= 0.25) {
            const equip = getShipSpecialEquip(ship.uid);
            if (!equip.hasDamageControl && !equip.hasGoddess) {
              hasTaihaRisk = true;
              taihaShipsList.push({
                uid: ship.uid,
                name: ship.name || `#${ship.uid}`,
                hpAfter: ship.hpAfter,
                hpMax: ship.hpMax,
              });
            }
          }
        }
      }

      // 保存本次大破风险及大破舰娘列表，供下一节点进击提醒使用
      setLastBattleHasTaihaRisk(hasTaihaRisk);
      setLastBattleTaihaShips(taihaShipsList);

      const battleResultAlert: BattleResultAlert = {
        type: 'battle_result',
        timestamp: now,
        cellId: record.cellId,
        isBoss: record.isBoss,
        rank: record.rank,
        hasTaihaRisk,
      };
      publishAlert(battleResultAlert);
    } catch (e) {
      console.warn('[battle] publishAlert(BattleResultAlert) failed:', String(e));
    }

    // 6. 清理战斗上下文
    if (context) {
      context.pendingBattle = null;
    }

    // 7. 重置模拟器，为下一场战斗做准备
    try {
      getBattlePredictionService().reset();
    } catch (_) { /* ignore if not initialised */ }

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
