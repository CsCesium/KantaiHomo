/**
 * Sortie Service - 出击状态管理
 * 跟踪当前出击状态，管理战斗上下文
 */

import type { ApiMapStartRespRaw, ApiMapNextRespRaw } from '../models/api/map';
import type { SortieCell } from '../models/struct/map';
import type {
  SortieContext,
  SortieResult,

} from '../models/struct/sortie';
import { createSortieContext, generateSortieId } from '../models/struct/sortie';
import type { Ship } from '../models/struct/ship';
import type { SlotItem } from '../models/struct/slotitem';
import { FleetSnapshot, ShipSnapshot, SlotItemSnapshot } from '../models';

// ==================== 出击上下文管理 (单例) ====================

let _currentContext: SortieContext | null = null;

/**
 * 获取当前出击上下文
 */
export function getSortieContext(): SortieContext | null {
  return _currentContext;
}

/**
 * 开始出击
 */
export function startSortie(
  data: ApiMapStartRespRaw,
  deckId: number,
  fleetSnapshot: FleetSnapshot,
  combinedType = 0,
  fleetSnapshotEscort?: FleetSnapshot
): SortieContext {
  // 结束之前的出击（如果有）
  if (_currentContext) {
    endSortie('retreated');
  }

  const context = createSortieContext(
    data.api_maparea_id,
    data.api_mapinfo_no,
    deckId,
    fleetSnapshot,
    combinedType,
    fleetSnapshotEscort
  );

  // 设置初始点位
  const startCell = mapRawToCell(data);
  context.currentCell = startCell;
  context.cellHistory.push(startCell);

  _currentContext = context;
  return context;
}

/**
 * 移动到下一个点位
 */
export function moveToNextCell(data: ApiMapNextRespRaw): SortieContext | null {
  if (!_currentContext) return null;

  const nextCell = mapRawToCell(data);
  _currentContext.currentCell = nextCell;
  _currentContext.cellHistory.push(nextCell);

  // 检查是否到达 Boss
  if (nextCell.isBoss) {
    _currentContext.bossReached = true;
  }

  return _currentContext;
}

/**
 * 结束出击
 */
export function endSortie(result: SortieResult): SortieContext | null {
  if (!_currentContext) return null;

  const context = _currentContext;
  context.result = result;

  // 检查 Boss 击杀
  if (result === 'cleared' && context.bossReached) {
    context.bossKilled = true;
  }

  _currentContext = null;
  return context;
}

/**
 * 清除当前出击上下文（异常情况）
 */
export function clearSortieContext(): void {
  _currentContext = null;
}

/**
 * 检查是否在出击中
 */
export function isInSortie(): boolean {
  return _currentContext !== null;
}

/**
 * 检查是否是演习
 */
export function isPractice(): boolean {
  // 演习不创建出击上下文，所以这里始终返回 false
  // 演习的处理在 BattleService 中单独处理
  return false;
}

// ==================== 舰队快照创建 ====================

/**
 * 创建舰队快照
 * @param deckId 舰队ID
 * @param deckName 舰队名称
 * @param ships 舰船列表（带装备信息）
 * @param slotItems 装备 Map (uid -> SlotItem)
 */
export function createFleetSnapshot(
  deckId: number,
  deckName: string,
  ships: Ship[],
  slotItemMap: Map<number, { item: SlotItem; masterName: string }>
): FleetSnapshot {
  const shipSnapshots: ShipSnapshot[] = [];

  for (const ship of ships) {
    const slots: (SlotItemSnapshot | null)[] = [];

    // 主装备槽
    for (const slotUid of ship.slots) {
      if (slotUid <= 0) {
        slots.push(null);
        continue;
      }
      const itemInfo = slotItemMap.get(slotUid);
      if (itemInfo) {
        slots.push({
          uid: itemInfo.item.uid,
          masterId: itemInfo.item.masterId,
          name: itemInfo.masterName,
          level: itemInfo.item.level ?? 0,
          alv: itemInfo.item.alv,
        });
      } else {
        slots.push(null);
      }
    }

    // 补强增设
    let slotEx: SlotItemSnapshot | null = null;
    if (ship.exSlot > 0) {
      const exInfo = slotItemMap.get(ship.exSlot);
      if (exInfo) {
        slotEx = {
          uid: exInfo.item.uid,
          masterId: exInfo.item.masterId,
          name: exInfo.masterName,
          level: exInfo.item.level ?? 0,
          alv: exInfo.item.alv,
        };
      }
    }

    shipSnapshots.push({
      uid: ship.uid,
      masterId: ship.masterId,
      name: '', // 需要从 master 获取
      shipType: 0, // 需要从 master 获取
      level: ship.level,
      hpNow: ship.hpNow,
      hpMax: ship.hpMax,
      fuel: ship.fuel,
      ammo: ship.ammo,
      fuelMax: 100, // 需要从 master 获取
      ammoMax: 100, // 需要从 master 获取
      cond: ship.cond,
      slots,
      slotEx,
      onslot: ship.onslot,
    });
  }

  return {
    deckId,
    name: deckName,
    ships: shipSnapshots,
    capturedAt: Date.now(),
  };
}

/**
 * 带 Master 信息的舰船快照创建
 */
export function createShipSnapshotWithMaster(
  ship: Ship,
  masterName: string,
  shipType: number,
  fuelMax: number,
  ammoMax: number,
  slotItemMap: Map<number, { item: SlotItem; masterName: string }>
): ShipSnapshot {
  const slots: (SlotItemSnapshot | null)[] = [];

  for (const slotUid of ship.slots) {
    if (slotUid <= 0) {
      slots.push(null);
      continue;
    }
    const itemInfo = slotItemMap.get(slotUid);
    if (itemInfo) {
      slots.push({
        uid: itemInfo.item.uid,
        masterId: itemInfo.item.masterId,
        name: itemInfo.masterName,
        level: itemInfo.item.level ?? 0,
        alv: itemInfo.item.alv,
      });
    } else {
      slots.push(null);
    }
  }

  let slotEx: SlotItemSnapshot | null = null;
  if (ship.exSlot > 0) {
    const exInfo = slotItemMap.get(ship.exSlot);
    if (exInfo) {
      slotEx = {
        uid: exInfo.item.uid,
        masterId: exInfo.item.masterId,
        name: exInfo.masterName,
        level: exInfo.item.level ?? 0,
        alv: exInfo.item.alv,
      };
    }
  }

  return {
    uid: ship.uid,
    masterId: ship.masterId,
    name: masterName,
    shipType,
    level: ship.level,
    hpNow: ship.hpNow,
    hpMax: ship.hpMax,
    fuel: ship.fuel,
    ammo: ship.ammo,
    fuelMax,
    ammoMax,
    cond: ship.cond,
    slots,
    slotEx,
    onslot: ship.onslot,
  };
}

// ==================== 辅助函数 ====================

function mapRawToCell(raw: ApiMapStartRespRaw | ApiMapNextRespRaw): SortieCell {
  return {
    mapAreaId: raw.api_maparea_id,
    mapInfoNo: raw.api_mapinfo_no,
    cellId: raw.api_cell_id,
    eventId: raw.api_event_id,
    eventKind: raw.api_event_kind,
    next: raw.api_next,
    isBoss: raw.api_event_id === 5,  // Boss 事件
    bossCellNo: raw.api_bosscell_no,
    updatedAt: Date.now(),
  };
}
