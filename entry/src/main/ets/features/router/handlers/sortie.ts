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
import { startSortie, moveToNextCell } from '../../../domain/service';
import { publishAlert } from '../../alerts/bus';
import { SortieNextAlert, TaihaWarningAlert } from '../../alerts/type';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

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

    console.info('[sortie] started:', context.sortieId, 'map:', `${mapAreaId}-${mapInfoNo}`);

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

    // 4. 发布事件
    if (PersistDeps.publish) {
      PersistDeps.publish('sortie:started', {
        sortieId: context.sortieId,
        mapAreaId,
        mapInfoNo,
        deckId,
      });
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

    // 2. 发布 SortieNextAlert
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
    };
    publishAlert(sortieNextAlert);

    // 3. 检查大破状态（仅在战斗节点前检查）
    if (isBattleEventId(cell.eventId)) {
      await this.checkTaihaAndAlert(context.deckId, PersistDeps);
    }

    // 4. 检查是否是战斗节点，创建战斗上下文
    if (isBattleEvent(cell.eventId)) {
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

    // 6. 发布事件
    if (PersistDeps.publish) {
      PersistDeps.publish('sortie:cell_moved', {
        cell,
        cellIndex: context.cellHistory.length - 1,
      });

      // Boss 点到达提醒
      if (cell.isBoss) {
        PersistDeps.publish('sortie:boss_reached', { cell });
      }
    }
  }

  /**
   * 检查舰队大破状态并发布警告
   */
  private async checkTaihaAndAlert(deckId: number, PersistDeps: PersistDeps): Promise<void> {
    if (!PersistDeps.repos?.deck || !PersistDeps.repos?.ship) {
      return;
    }

    try {
      const deck = await PersistDeps.repos.deck.get(deckId);
      if (!deck) return;

      const shipUidsJson = deck.shipUidsJson;
      const shipUids: number[] = shipUidsJson ? JSON.parse(shipUidsJson) : [];

      const taihaShips: { uid: number; name: string }[] = [];

      for (const uid of shipUids) {
        if (uid <= 0) continue;

        const shipWithMaster = await PersistDeps.repos.ship.getWithMaster(uid);
        if (!shipWithMaster) continue;

        const { nowHp, maxHp } = shipWithMaster;
        const hpPercent = maxHp > 0 ? (nowHp / maxHp) : 1;

        // 大破判定: HP <= 25%
        if (hpPercent <= 0.25) {
          const name = shipWithMaster.mst_name ?? `Ship#${uid}`;
          taihaShips.push({ uid, name });
        }
      }

      if (taihaShips.length > 0) {
        console.warn('[sortie] TAIHA detected:', taihaShips.map(s => s.name).join(', '));

        const taihaAlert: TaihaWarningAlert = {
          type: 'taiha_warning',
          timestamp: Date.now(),
          shipUids: taihaShips.map(s => s.uid),
          shipNames: taihaShips.map(s => s.name),
        };
        publishAlert(taihaAlert);
      }
    } catch (e) {
      console.error('[sortie] check taiha failed:', String(e));
    }
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
