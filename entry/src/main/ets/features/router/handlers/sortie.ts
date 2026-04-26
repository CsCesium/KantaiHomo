/**
 * Sortie  Handler
 *
 * 职责：
 * 1. 订阅 Sortie 领域事件 (SORTIE_START, SORTIE_NEXT)
 * 2. 调用 Service 管理出击状态
 * 3. 持久化出击记录
 * 4. 发布 UI 通知事件
 * 5. 检查大破状态并发布警告
 *
 * 与 Port Handler 保持一致的模式
 */
import { SortieStartEvent, SortieNextEvent, SortieStartPayload, SortieNextPayload } from '../../../domain/events';
import {
  sortieRecordToRow,
  getFullEventDesc,
  isBattleEventId,
  isBattleEvent,
  createBattleContext,
  safeParseJsonArray
} from '../../../domain/models';
import type { AirBaseSnapshot, AirBaseSquadronSnapshot } from '../../../domain/models/struct/battle_record';
import { startSortie, moveToNextCell } from '../../../domain/service';
import { publishAlert } from '../../alerts/bus';
import { SortieNextAlert, TaihaWarningAlert } from '../../alerts/type';
import { getLastBattleHasTaihaRisk, getLastBattleTaihaShips, resetLastBattleState } from '../../alerts/lastBattleState';
import { getShipMasterName, clearBattleState, getLbas, getSlotItemMasterId } from '../../state/game_state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

/** 将 LbasBase 转换为出击快照格式（解析 slotId → masterId） */
function captureLbasSnapshot(): AirBaseSnapshot[] {
  return getLbas()
    .filter(base => base.actionKind === 1 || base.actionKind === 2)  // 出击 or 防空
    .map(base => ({
      baseId: base.baseId,
      name: base.name,
      actionKind: base.actionKind,
      squadrons: base.squadrons
        .filter(sq => sq.slotId > 0)
        .map((sq): AirBaseSquadronSnapshot => ({
          masterId: getSlotItemMasterId(sq.slotId) ?? 0,
          count: sq.count,
          cond: sq.cond,
        })),
    }));
}

function isSortieStartEvent(ev: HandlerEvent): ev is SortieStartEvent {
  return ev.type === 'SORTIE_START';
}

function isSortieNextEvent(ev: HandlerEvent): ev is SortieNextEvent {
  return ev.type === 'SORTIE_NEXT';
}

class SortieHandler implements Handler {
  async handle(ev: HandlerEvent, PersistDeps: PersistDeps): Promise<void> {
    if (isSortieStartEvent(ev)) {
      await this.handleSortieStart(ev.payload, PersistDeps);
    } else if (isSortieNextEvent(ev)) {
      await this.handleSortieNext(ev.payload, PersistDeps);
    }
  }

  /**
   * 处理出击开始
   */
  private async handleSortieStart(
    payload: SortieStartPayload,
    PersistDeps: PersistDeps
  ): Promise<void> {
    const { mapAreaId, mapInfoNo, cellId, deckId, combinedType, fleetSnapshot, fleetSnapshotEscort } = payload;
    // 新出击：重置上次战斗的大破风险状态
    resetLastBattleState();

    // 1. 尝试从 Repository 获取更完整的舰队快照
    const actualFleetSnapshot = await this.captureFleetSnapshot(deckId, PersistDeps) || fleetSnapshot;
    const actualFleetSnapshotEscort = combinedType > 0
      ? await this.captureFleetSnapshot(2, PersistDeps)
      : fleetSnapshotEscort;

    // 2. 调用 Service 创建出击上下文
    const context = startSortie(
      { api_maparea_id: mapAreaId, api_mapinfo_no: mapInfoNo, api_cell_id: cellId } as any,
      deckId,
      actualFleetSnapshot,
      combinedType,
      actualFleetSnapshotEscort
    );

    // 3. 捕获基地航空队快照（仅出击/防空状态的基地）
    const airBases = captureLbasSnapshot();
    if (airBases.length > 0) {
      context.airBases = airBases;
    }

    console.info('[sortie] started:', context.sortieId, 'map:', `${mapAreaId}-${mapInfoNo}`,
      'airBases:', airBases.length);

    // 3. 持久化出击记录
    if (PersistDeps.repos?.sortie) {
      try {
        const row = sortieRecordToRow({
          id: context.sortieId,
          mapAreaId,
          mapInfoNo,
          deckId,
          combinedType,
          fleetSnapshot: actualFleetSnapshot,
          fleetSnapshotEscort: actualFleetSnapshotEscort,
          route: [cellId],
          result: 'ongoing',
          bossReached: false,
          bossKilled: false,
          fuelUsed: 0,
          ammoUsed: 0,
          startedAt: context.startTime,
        });
        await PersistDeps.repos.sortie.insert(row);
      } catch (e) {
        console.error('[sortie] save failed:', String(e));
      }
    }


  }

  /**
   * 处理进入下一节点
   */
  private async handleSortieNext(
    payload: SortieNextPayload,
    PersistDeps: PersistDeps
  ): Promise<void> {
    const { cell } = payload;

    // Clear any battle state from the previous cell so the normal panel is restored.
    clearBattleState();

    // 1. 调用 Service 更新节点
    const context = moveToNextCell({
      api_maparea_id: cell.mapAreaId,
      api_mapinfo_no: cell.mapInfoNo,
      api_cell_id: cell.cellId,
      api_event_id: cell.eventId,
      api_event_kind: cell.eventKind,
      api_next: cell.next,
      api_bosscell_no: cell.bossCellNo,
    } as any);

    if (!context) {
      console.warn('[sortie] no active sortie context');
      return;
    }

    console.info('[sortie] moved to cell:', cell.cellId, 'event:', cell.eventId, 'boss:', cell.isBoss);

    // 2. 发布 SortieNextAlert（所有节点类型均触发，含战斗节点）
    // 尝试从 /next 响应的 api_enemy_info 中提取敌方旗舰名称（仅战斗节点有效）
    let enemyFlagshipName: string | undefined;
    if (isBattleEventId(cell.eventId)) {
      try {
        const extras = cell.extras as Record<string, unknown> | undefined;
        const enemyInfo = extras?.api_enemy_info as Record<string, unknown> | undefined;
        const shipKe = Array.isArray(enemyInfo?.api_ship_ke)
          ? (enemyInfo!.api_ship_ke as number[])
          : [];
        const firstId = shipKe.find((id: number) => id > 0);
        if (firstId) {
          enemyFlagshipName = getShipMasterName(firstId);
        }
      } catch {
        // extras 解析失败则忽略
      }
    }

    const sortieNextAlert: SortieNextAlert = {
      type: 'sortie_next',
      timestamp: Date.now(),
      mapAreaId: cell.mapAreaId,
      mapInfoNo: cell.mapInfoNo,
      cellId: cell.cellId,
      eventId: cell.eventId,
      eventKind: cell.eventKind,
      isBoss: cell.isBoss ?? false,
      eventDesc: getFullEventDesc(cell.eventId, cell.eventKind),
      deckId: context.deckId,
      combinedType: context.combinedType,
      fleetName: context.fleetSnapshot.name,
      hasTaihaRisk: getLastBattleHasTaihaRisk(),
      enemyFlagshipName,
    };
    publishAlert(sortieNextAlert);

    // 3. 检查大破状态（仅在战斗节点前检查，使用上次战斗结算保存的大破信息）
    if (isBattleEventId(cell.eventId)) {
      this.checkTaihaAndAlert();
    }

    // 4. 检查是否是战斗节点，创建战斗上下文
    if (isBattleEventId(cell.eventId)) {
      context.pendingBattle = createBattleContext(cell, false, context.combinedType > 0);
      console.info('[sortie] battle context created');
    }

    // 5. 更新路由
    if (PersistDeps.repos?.sortie) {
      try {
        const existing = await PersistDeps.repos.sortie.get(context.sortieId);
        if (existing) {
          const route: number[] = JSON.parse(existing.routeJson);
          route.push(cell.cellId);

          await PersistDeps.repos.sortie.update({
            ...existing,
            routeJson: JSON.stringify(route),
            bossReached: context.bossReached ? 1 : 0,
          });
        }
      } catch (e) {
        console.error('[sortie] update route failed:', String(e));
      }
    }
  }

  /**
   * 检查大破状态并发布警告
   *
   * 使用上一场战斗结算时保存的大破舰娘信息（post-battle HP），
   * 避免读取 DB 中已过期的出击前 HP 数据。
   */
  private checkTaihaAndAlert(): void {
    const taihaShips = getLastBattleTaihaShips();
    if (taihaShips.length === 0) return;

    console.warn('[sortie] TAIHA detected (from last battle):', taihaShips.map(s => s.name).join(', '));

    const taihaAlert: TaihaWarningAlert = {
      type: 'taiha_warning',
      timestamp: Date.now(),
      shipUids: taihaShips.map(s => s.uid),
      shipNames: taihaShips.map(s => s.name),
    };
    publishAlert(taihaAlert);
  }

  // ==================== 辅助方法 ====================

  /**
   * 捕获舰队快照
   * TODO: 从 Repository 获取完整的舰船和装备信息
   */
  private async captureFleetSnapshot(
    deckId: number,
    PersistDeps: PersistDeps
  ): Promise<{ deckId: number; name: string; ships: any[]; capturedAt: number }> {
    // 尝试从 Repository 获取
    if (PersistDeps.repos?.deck && PersistDeps.repos?.ship) {
      try {
        const deck = await PersistDeps.repos.deck.get(deckId);
        if (deck) {
          const ships: any[] = [];
          const shipUids = safeParseJsonArray(deck.shipUidsJson)

          for (const uid of shipUids) {
            if (uid > 0) {
              const row = await PersistDeps.repos.ship.getWithMaster(uid);
              if (row) {
                ships.push({
                  uid: row.uid,
                  masterId: row.masterId,
                  name: row.mst_name ?? '',
                  shipType: row.mst_stype ?? 0,
                  level: row.level,
                  hpNow: row.nowHp,
                  hpMax: row.maxHp,
                  fuel: row.fuel,
                  ammo: row.bull,
                  fuelMax: 100, // TODO: 从 master 获取
                  ammoMax: 100,
                  cond: row.cond,
                  slots: row.slotsJson ? JSON.parse(row.slotsJson) : [],
                  onslot: row.onslotJson ? JSON.parse(row.onslotJson) : [],
                });
              }
            }
          }

          return {
            deckId,
            name: deck.name,
            ships,
            capturedAt: Date.now(),
          };
        }
      } catch (e) {
        console.warn('[sortie] failed to capture fleet snapshot:', String(e));
      }
    }

    // 返回空快照
    return {
      deckId,
      name: `Fleet ${deckId}`,
      ships: [],
      capturedAt: Date.now(),
    };
  }
}

// 注册处理器
registerHandler('SORTIE_START', new SortieHandler());
registerHandler('SORTIE_NEXT', new SortieHandler());
