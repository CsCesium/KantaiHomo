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
import type { FleetSnapshot, ShipSnapshot, SlotItemSnapshot } from '../../../domain/models/struct/battle_record';
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
    const { mapAreaId, mapInfoNo, cellId, cell, deckId, combinedType, fleetSnapshot, fleetSnapshotEscort } = payload;
    // 新出击：重置上次战斗的大破风险状态
    resetLastBattleState();

    // 1. 尝试从 Repository 获取更完整的舰队快照
    const actualFleetSnapshot = (await this.captureFleetSnapshot(deckId, PersistDeps)) ?? fleetSnapshot;
    const actualFleetSnapshotEscort = combinedType > 0
      ? (await this.captureFleetSnapshot(2, PersistDeps)) ?? fleetSnapshotEscort
      : fleetSnapshotEscort;

    // 2. 调用 Service 创建出击上下文
    const context = startSortie(
      {
        api_maparea_id: mapAreaId,
        api_mapinfo_no: mapInfoNo,
        api_cell_id: cellId,
        api_event_id: cell.eventId,
        api_event_kind: cell.eventKind,
        api_next: cell.next,
        api_color_no: cell.colorNo,
        api_bosscell_no: cell.bossCellNo,
      } as any,
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

    // 4. GameState 双保险：出击瞬间扫描出击编队，捕捉带伤强行出击
    //    （此时 GameState.ships 仍反映港内最新 HP；进入战斗后该数据会失效，
    //    后续节点检查由 lastBattleState 接管）
    this.checkSortieStartTaiha(deckId, combinedType);
  }

  /**
   * 出击瞬间基于 GameState 检查整个出击编队是否存在大破舰
   *
   * 跳过主队旗舰（i=0，旗舰不会击沉），联合舰队护卫队所有舰位都参与检查
   */
  private checkSortieStartTaiha(deckId: number, combinedType: number): void {
    const risky: { uid: number; name: string; hpNow: number; hpMax: number }[] = [];

    const main = getDeckShips(deckId);
    for (let i = 1; i < main.length; i++) {
      const s = main[i];
      if (!s.isTaiha) continue;
      if (s.hpNow <= 0) continue; // 已击沉的不参与（不可能出击但作防御性判断）
      const equip = getShipSpecialEquip(s.uid);
      if (equip.hasDamageControl || equip.hasGoddess) continue;
      risky.push({ uid: s.uid, name: s.name || `#${s.uid}`, hpNow: s.hpNow, hpMax: s.hpMax });
    }

    if (combinedType > 0) {
      const escort = getDeckShips(2);
      for (let i = 0; i < escort.length; i++) {
        const s = escort[i];
        if (!s.isTaiha) continue;
        if (s.hpNow <= 0) continue;
        const equip = getShipSpecialEquip(s.uid);
        if (equip.hasDamageControl || equip.hasGoddess) continue;
        risky.push({ uid: s.uid, name: s.name || `#${s.uid}`, hpNow: s.hpNow, hpMax: s.hpMax });
      }
    }

    if (risky.length === 0) return;

    console.warn('[sortie] SORTIE START taiha (GameState):', risky.map(r => r.name).join(', '));

    const alert: SortieStartTaihaAlert = {
      type: 'sortie_start_taiha',
      timestamp: Date.now(),
      deckId,
      ships: risky,
    };
    publishAlert(alert);
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
      api_color_no: cell.colorNo,
      api_bosscell_no: cell.bossCellNo,
    } as any);

    if (!context) {
      console.warn('[sortie] no active sortie context');
      return;
    }

    const currentCell = context.currentCell ?? cell;

    console.info('[sortie] moved to cell:', currentCell.cellId, 'event:', currentCell.eventId, 'boss:', currentCell.isBoss);

    // 2. 发布 SortieNextAlert（所有节点类型均触发，含战斗节点）
    // 尝试从 /next 响应的 api_enemy_info 中提取敌方旗舰名称（仅战斗节点有效）
    let enemyFlagshipName: string | undefined;
    if (isBattleEventId(currentCell.eventId)) {
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
      cellId: currentCell.cellId,
      eventId: currentCell.eventId,
      eventKind: currentCell.eventKind,
      isBoss: currentCell.isBoss ?? false,
      eventDesc: getFullEventDesc(currentCell.eventId, currentCell.eventKind),
      deckId: context.deckId,
      combinedType: context.combinedType,
      fleetName: context.fleetSnapshot.name,
      hasTaihaRisk: getLastBattleHasTaihaRisk(),
      enemyFlagshipName,
      resourceGains: cell.resourceGains,
    };
    publishAlert(sortieNextAlert);

    // 3. 检查大破状态（仅在战斗节点前检查，使用上次战斗结算保存的大破信息）
    if (isBattleEventId(currentCell.eventId)) {
      this.checkTaihaAndAlert();
    }

    // 4. 检查是否是战斗节点，创建战斗上下文
    if (isBattleEventId(currentCell.eventId)) {
      context.pendingBattle = createBattleContext(currentCell, false, context.combinedType > 0);
      console.info('[sortie] battle context created');
    }

    // 5. 更新路由
    if (PersistDeps.repos?.sortie) {
      try {
        const existing = await PersistDeps.repos.sortie.get(context.sortieId);
        if (existing) {
          const route: number[] = JSON.parse(existing.routeJson);
          route.push(currentCell.cellId);

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
  ): Promise<FleetSnapshot | null> {
    const memorySnapshot = this.captureFleetSnapshotFromState(deckId);
    if (memorySnapshot && memorySnapshot.ships.length > 0) {
      return memorySnapshot;
    }

    // 尝试从 Repository 获取
    if (PersistDeps.repos?.deck && PersistDeps.repos?.ship) {
      try {
        const deck = await PersistDeps.repos.deck.get(deckId);
        if (deck) {
          const ships: ShipSnapshot[] = [];
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
                  slots: this.slotUidArrayToSnapshots(row.slotsJson ? JSON.parse(row.slotsJson) : []),
                  slotEx: this.slotUidToSnapshot(row.slotEx ?? 0),
                  onslot: row.onslotJson ? JSON.parse(row.onslotJson) : [],
                });
              }
            }
          }

          if (ships.length > 0) {
            return {
              deckId,
              name: deck.name,
              ships,
              capturedAt: Date.now(),
            };
          }
        }
      } catch (e) {
        console.warn('[sortie] failed to capture fleet snapshot:', String(e));
      }
    }

    return null;
  }

  private captureFleetSnapshotFromState(deckId: number): FleetSnapshot | null {
    const deck = getDeck(deckId);
    if (!deck) return null;

    const ships: ShipSnapshot[] = getDeckShips(deckId).map((ship): ShipSnapshot => ({
      uid: ship.uid,
      masterId: ship.masterId,
      name: ship.name,
      shipType: 0,
      level: ship.level,
      hpNow: ship.hpNow,
      hpMax: ship.hpMax,
      fuel: ship.fuel,
      ammo: ship.ammo,
      fuelMax: ship.fuelMax,
      ammoMax: ship.ammoMax,
      cond: ship.cond,
      slots: this.slotUidArrayToSnapshots(ship.slots.slice(0, ship.slotCount)),
      slotEx: this.slotUidToSnapshot(ship.exSlot),
      onslot: [...ship.onslot],
    }));

    if (ships.length === 0) return null;

    return {
      deckId,
      name: deck.name,
      ships,
      capturedAt: Date.now(),
    };
  }

  private slotUidArrayToSnapshots(slotUids: number[]): (SlotItemSnapshot | null)[] {
    return slotUids.map(uid => this.slotUidToSnapshot(uid));
  }

  private slotUidToSnapshot(slotUid: number): SlotItemSnapshot | null {
    if (slotUid <= 0) return null;
    return {
      uid: slotUid,
      masterId: getSlotItemMasterId(slotUid) ?? 0,
      name: '',
      level: 0,
    };
  }
}

// 注册处理器
registerHandler('SORTIE_START', new SortieHandler());
registerHandler('SORTIE_NEXT', new SortieHandler());
