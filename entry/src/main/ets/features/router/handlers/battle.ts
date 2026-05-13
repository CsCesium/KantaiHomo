import { AnyBattleEvt, BattleDayPayload, BattleNightPayload, BattleResultPayload } from '../../../domain/events/battle';
import {
  BattleSegment,
  BattlePrediction,
  mergeBattleSegments,
  BattleRecord,
  generateBattleId,
  battleRecordToRow,
  createBattleContext,
  createSortieContext,
  FleetSnapshot,
  ShipSnapshot,
  SlotItemSnapshot,
  SortieCell,
  SortieContext,
} from '../../../domain/models';
import { getSortieContext, setSortieContext, clearSortieContext, enrichPredictionWithShipInfo, checkTaihaAdvanceRisk, predictBattle } from '../../../domain/service';
import { buildDayBattleStatus, buildNightBattleStatus, buildBattleResultSnapshot } from '../../state/battle_state';
import { updateBattleStatus, updateBattleResult, getShipSpecialEquip, getDeck, getDeckShips, getSlotItemMasterId } from '../../state/game_state';
import type { ShipState } from '../../state/type';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';
import { publishAlert } from '../../alerts/bus';
import { setLastBattleHasTaihaRisk, setLastBattleTaihaShips } from '../../alerts/lastBattleState';
import type { BattleResultAlert } from '../../alerts/type';
import { getBattlePredictionService } from '../../simulator';

// ==================== 演习预览支持 ====================
//
// 演习不会触发 api_req_map/start，因此没有真实的 SortieContext。
// 为了让 BattlePreviewPanel 能在演习中显示预测/结果，演习首个 BATTLE_*
// 事件到达时按当前 deck 合成一个最小 SortieContext 写入全局，让后续
// 处理逻辑（包括 BATTLE_RESULT）走与正常出击一致的路径。
// 演习结算后再清掉合成上下文，避免影响后续真实出击。

function slotUidToSnapshot(slotUid: number): SlotItemSnapshot | null {
  if (slotUid <= 0) return null;
  return {
    uid: slotUid,
    masterId: getSlotItemMasterId(slotUid) ?? 0,
    name: '',
    level: 0,
  };
}

function buildPracticeFleetSnapshot(deckId: number, ts: number): FleetSnapshot | null {
  const deck = getDeck(deckId);
  if (!deck) return null;
  const ships = getDeckShips(deckId);
  if (ships.length === 0) return null;

  const shipSnaps: ShipSnapshot[] = ships.map((s: ShipState): ShipSnapshot => ({
    uid: s.uid,
    masterId: s.masterId,
    name: s.name,
    shipType: 0,
    level: s.level,
    hpNow: s.hpNow,
    hpMax: s.hpMax,
    fuel: s.fuel,
    ammo: s.ammo,
    fuelMax: s.fuelMax,
    ammoMax: s.ammoMax,
    cond: s.cond,
    slots: s.slots.slice(0, s.slotCount).map(slotUidToSnapshot),
    slotEx: slotUidToSnapshot(s.exSlot),
    onslot: [...s.onslot],
  }));

  return {
    deckId,
    name: deck.name,
    ships: shipSnaps,
    capturedAt: ts,
  };
}

/**
 * 从 prediction.friendMain/friendEscort 反推一个最小 FleetSnapshot —— 仅用于
 * 当 GameState 里实际 deck 为空（比如 master 包还没回来）时，让预览至少能
 * 按"敌我各 N 艘"的形态显示，而不是直接看不到。HP 占位用 prediction 数据。
 */
function buildPracticeFleetSnapshotFromPrediction(
  predictions: { uid: number; name: string; hpBefore: number; hpMax: number }[],
  deckId: number,
  ts: number,
): FleetSnapshot {
  const ships: ShipSnapshot[] = predictions
    .filter(p => p.hpMax > 0)
    .map((p, i): ShipSnapshot => ({
      uid: p.uid > 0 ? p.uid : -(i + 1),
      masterId: 0,
      name: p.name || `艦${i + 1}`,
      shipType: 0,
      level: 0,
      hpNow: p.hpBefore,
      hpMax: p.hpMax,
      fuel: 0,
      ammo: 0,
      fuelMax: 0,
      ammoMax: 0,
      cond: 49,
      slots: [],
      slotEx: null,
      onslot: [],
    }));
  return { deckId, name: `Fleet ${deckId}`, ships, capturedAt: ts };
}

/**
 * 演习专用：若当前没有 SortieContext，按 segment + 当前 deck 合成一个并写入全局。
 * 已存在 context 时直接返回（避免覆盖真实出击）。
 *
 * 兜底策略（按优先级）：
 *   1. segment.meta.deckId 指定的 deck（响应里通常有 api_deck_id）
 *   2. deck 1..4 中第一个非空的 deck
 *   3. 直接由 prediction 反推，确保至少能渲染出舰列表
 */
function ensurePracticeContext(segment: BattleSegment, prediction: BattlePrediction): SortieContext | null {
  const existing = getSortieContext();
  if (existing) return existing;

  const isCombined = !!segment.start.friend.escort;
  const ts = Date.now();

  const preferredDeckId = segment.meta.deckId ?? 1;

  const tryDecks: number[] = [preferredDeckId, 1, 2, 3, 4];
  let fleetSnapshot: FleetSnapshot | null = null;
  let resolvedDeckId = preferredDeckId;
  for (const id of tryDecks) {
    const snap = buildPracticeFleetSnapshot(id, ts);
    if (snap) {
      fleetSnapshot = snap;
      resolvedDeckId = id;
      break;
    }
  }
  // 真实 deck 信息缺失时，从 prediction 反推一个最小 fleet snapshot。
  if (!fleetSnapshot) {
    fleetSnapshot = buildPracticeFleetSnapshotFromPrediction(prediction.friendMain, preferredDeckId, ts);
  }

  const fleetSnapshotEscort = isCombined
    ? (buildPracticeFleetSnapshot(resolvedDeckId + 1, ts)
        ?? (prediction.friendEscort
          ? buildPracticeFleetSnapshotFromPrediction(prediction.friendEscort, resolvedDeckId + 1, ts)
          : undefined))
    : undefined;

  const ctx = createSortieContext(0, 0, resolvedDeckId, fleetSnapshot, isCombined ? 1 : 0, fleetSnapshotEscort);
  const cell: SortieCell = {
    mapAreaId: 0,
    mapInfoNo: 0,
    cellId: 0,
    eventId: 0,
    eventKind: 0,
    next: 0,
    isBoss: false,
    updatedAt: ts,
  };
  ctx.currentCell = cell;

  setSortieContext(ctx);
  return ctx;
}


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

    // 演习首个事件：按当前 deck 合成一个最小 SortieContext 让预览生效。
    if (isPractice) {
      ensurePracticeContext(segment, prediction);
    }

    // 1. 获取出击上下文，更新内存状态
    const context = getSortieContext();
    if (context) {
      // 用舰船信息丰富预测；基地空袭的 friend 一侧是基地，parser 已用 LBAS 名填好，
      // 此处跳过避免被舰队名覆盖。
      // parser 在 TaskPool worker 里跑时拿不到 simulator/上下文，prediction 退化为
      // 起始 HP 占位，看起来就是"没伤害"。在主线程的 handler 里基于 segment 重新
      // 跑一次纯函数 predictBattle，保证 hp / damage / 大破等字段始终反映本次 dump。
      if (!isAirRaid) {
        prediction = enrichPredictionWithShipInfo(
          predictBattle(segment),
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

    // 演习直入夜战(api_req_practice/midnight_battle 罕见但可能)：合成上下文。
    if (isPractice) {
      ensurePracticeContext(segment, prediction);
    }

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
      // parser 在 TaskPool worker 中跑时拿不到 simulator，payload.prediction 会退化为
      // 「夜战起点 HP, 无伤害」的占位，导致 BattlePreview 看起来一直停在昼战结果。
      // 在主线程基于 merged segment 重新跑 predictBattle，确保夜战的 HP / 伤害 /
      // 大破状态被正确显示，并保持下标对齐。
      prediction = enrichPredictionWithShipInfo(
        predictBattle(merged),
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

    // 3. 战斗结算阶段不再回写 GameState.ships。
    //    BattlePreview 显示的结果数据来自 prediction（在战斗段时就已计算好），
    //    main panel 的 GameState 留到下一次 api_req_map/next 或 /api_port/port
    //    再统一刷新，避免本地预测的索引偏差污染主面板 HP。

    // 3b. 更新战斗结果状态快照 (供 BattlePreview 渲染 result header / drop 等)
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
    if (isPractice) {
      // 演习不进击下一节点，跳过提醒；同时清掉上一节点遗留的大破标记。
      setLastBattleHasTaihaRisk(false);
      setLastBattleTaihaShips([]);
    } else {
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
    }

    // 6. 清理战斗上下文
    if (context) {
      context.pendingBattle = null;
    }
    // 演习的 SortieContext 是合成的，结算后清掉避免泄漏到下一次真实出击。
    if (isPractice) {
      clearSortieContext();
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
