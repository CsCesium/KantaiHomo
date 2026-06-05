// ==================== 类型定义 ====================
import {
  updateFromPort,
  updateAdmiral,
  updateMaterials,
  patchMaterials,
  updateDecks,
  updateNdocks,
  updateKdocks,
  updateShips,
  updateSlotItemIndex,
  getGameState,
  getMaterials
} from ".";
import {
  ApiBasicRaw,
  ApiMaterialItemRaw,
  ApiDeckPortRaw,
  ApiShipRaw,
  ApiNdockRaw,
  ApiKdockRaw,
  normalizeAdmiral,
  normalizeMaterials,
  normalizeDecks,
  normalizeNdocks,
  normalizeKdocks,
  normalizeShip,
  normalizeShips
} from "../../domain/models";
import { ApiSlotItemRaw } from "../../domain/models/api/slotitem";

/** API 响应中可能包含的状态字段 */
interface StateFields {
  // 提督信息
  api_basic?: ApiBasicRaw;

  // 资源
  api_material?: ApiMaterialItemRaw[];
  api_bauxite?: number;

  // 舰队 (port 使用 api_deck_port, 其他使用 api_deck_data)
  api_deck?: unknown;
  api_deck_port?: unknown;
  api_deck_data?: unknown;

  // 舰船 (port 使用 api_ship, ship2/ship3 使用 api_ship_data)
  api_ship?: unknown;
  api_ship_data?: unknown;

  // 入渠/建造
  api_ndock?: unknown;
  api_kdock?: unknown;

  // 装备实例列表（require_info / kaisou / kousyou 等响应都会带）
  api_slot_item?: ApiSlotItemRaw[];

  // 允许其他字段
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isShipRaw(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.api_id === 'number' && typeof value.api_ship_id === 'number';
}

function isDeckRaw(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.api_id === 'number' && Array.isArray(value.api_ship);
}

function isNdockRaw(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.api_id === 'number' && typeof value.api_state === 'number' && typeof value.api_ship_id === 'number';
}

function isKdockRaw(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.api_id === 'number' && typeof value.api_state === 'number' && 'api_created_ship_id' in value;
}

function rawFieldToArray<T>(value: unknown, isSingle: (value: unknown) => boolean): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  if (isSingle(value)) return [value as T];

  const out: T[] = [];
  const values = Object.values(value);
  for (const item of values) {
    if (isSingle(item)) {
      out.push(item as T);
    }
  }
  return out;
}

/** 提取结果 */
export interface ExtractResult {
  hasAdmiral: boolean;
  hasMaterials: boolean;
  hasDecks: boolean;
  hasShips: boolean;
  updated: boolean;
}

// ==================== 核心函数 ====================

/**
 * 从 API 响应中提取状态数据并更新 GameState
 *
 * @param apiData API 响应的 api_data 部分（已解开 envelope）
 * @param options 选项
 * @returns 提取结果
 */
export function extractAndUpdateState(
  apiData: unknown,
  options: {
    /** 是否更新提督信息 */
    updateAdmiral?: boolean;
    /** 是否更新资源 */
    updateMaterials?: boolean;
    /** 是否更新舰队 */
    updateDecks?: boolean;
    /** 是否更新舰船 */
    updateShips?: boolean;
    /** 是否使用批量更新 (Port 场景) */
    batchUpdate?: boolean;
  } = {}
): ExtractResult {
  const {
    updateAdmiral: doAdmiral = true,
    updateMaterials: doMaterials = true,
    updateDecks: doDecks = true,
    updateShips: doShips = true,
    batchUpdate = false,
  } = options;

  const result: ExtractResult = {
    hasAdmiral: false,
    hasMaterials: false,
    hasDecks: false,
    hasShips: false,
    updated: false,
  };

  if (!apiData || typeof apiData !== 'object') {
    return result;
  }

  const data = apiData as StateFields;
  const now = Date.now();

  // 提取各字段
  const admiralRaw = data.api_basic;
  const materialsRaw = data.api_material;
  const decksRaw: ApiDeckPortRaw[] = [
    ...rawFieldToArray<ApiDeckPortRaw>(data.api_deck_port, isDeckRaw),
    ...rawFieldToArray<ApiDeckPortRaw>(data.api_deck_data, isDeckRaw),
    ...rawFieldToArray<ApiDeckPortRaw>(data.api_deck, isDeckRaw),
  ];
  const shipsRaw: ApiShipRaw[] = [
    ...rawFieldToArray<ApiShipRaw>(data.api_ship, isShipRaw),
    ...rawFieldToArray<ApiShipRaw>(data.api_ship_data, isShipRaw),
  ];
  const ndocksRaw = rawFieldToArray<ApiNdockRaw>(data.api_ndock, isNdockRaw);
  const kdocksRaw = rawFieldToArray<ApiKdockRaw>(data.api_kdock, isKdockRaw);

  result.hasAdmiral = !!admiralRaw;
  result.hasMaterials = (!!materialsRaw && materialsRaw.length > 0) || typeof data.api_bauxite === 'number';
  result.hasDecks = decksRaw.length > 0;
  result.hasShips = shipsRaw.length > 0;

  // 内存装备实例索引：只刷 slotItemIndex/Levels/Alvs 给面板与计算用，
  // DB 持久化由 SLOTITEMS_UPDATE handler 在拿到完整列表时单独负责。
  const slotItemsRaw = data.api_slot_item;
  if (slotItemsRaw && slotItemsRaw.length > 0) {
    try {
      updateSlotItemIndex(slotItemsRaw.map(r => ({
        uid: r.api_id,
        masterId: r.api_slotitem_id,
        level: r.api_level ?? 0,
        alv: r.api_alv ?? 0,
      })));
    } catch (e) {
      console.warn('[StateExtractor] slotitem index update failed:', e);
    }
  }

  // 批量更新模式 (Port)
  if (batchUpdate) {
    const portData: Parameters<typeof updateFromPort>[0] = {};

    if (doAdmiral && admiralRaw) {
      portData.admiral = normalizeAdmiral(admiralRaw, now);
    }
    if (doMaterials && materialsRaw) {
      portData.materials = normalizeMaterials(materialsRaw, now);
    }
    if (doDecks && decksRaw.length > 0) {
      portData.decks = normalizeDecks(decksRaw, now);
    }
    if (doShips && shipsRaw.length > 0) {
      portData.ships = normalizeShips(shipsRaw, now);
    }

    if (Object.keys(portData).length > 0) {
      updateFromPort(portData);
      result.updated = true;
      console.debug('[StateExtractor] batch updated:', Object.keys(portData).join(', '));
    }

    return result;
  }

  // 单独更新模式
  if (doAdmiral && admiralRaw) {
    try {
      const admiral = normalizeAdmiral(admiralRaw, now);
      updateAdmiral(admiral);
      result.updated = true;
      console.debug('[StateExtractor] admiral updated');
    } catch (e) {
      console.warn('[StateExtractor] admiral normalize failed:', e);
    }
  }

  if (doMaterials && materialsRaw && materialsRaw.length > 0) {
    try {
      const materials = normalizeMaterials(materialsRaw, now);
      // /api_get_member/material 仅返回 4 项基础资源（api_id 1-4），
      // normalizeMaterials 会把缺失的道具资源（api_id 5-8）默认为 0；
      // 直接 updateMaterials 会清空 GameState 中的速建/速修/开发/螺母。
      // 缺项时用当前快照回填，避免补给/收获远征界面切换时资源栏被清空。
      const presentIds = new Set<number>();
      for (const it of materialsRaw) presentIds.add(it.api_id);
      const allPresent = presentIds.has(1) && presentIds.has(2) && presentIds.has(3) && presentIds.has(4)
        && presentIds.has(5) && presentIds.has(6) && presentIds.has(7) && presentIds.has(8);
      if (!allPresent) {
        const current = getMaterials();
        if (current) {
          if (!presentIds.has(1)) materials.fuel = current.fuel;
          if (!presentIds.has(2)) materials.ammo = current.ammo;
          if (!presentIds.has(3)) materials.steel = current.steel;
          if (!presentIds.has(4)) materials.bauxite = current.bauxite;
          if (!presentIds.has(5)) materials.instantBuild = current.instantBuild;
          if (!presentIds.has(6)) materials.instantRepair = current.instantRepair;
          if (!presentIds.has(7)) materials.devMaterial = current.devMaterial;
          if (!presentIds.has(8)) materials.screw = current.screw;
        }
      }
      updateMaterials(materials);
      result.updated = true;
      console.debug('[StateExtractor] materials updated');
    } catch (e) {
      console.warn('[StateExtractor] materials normalize failed:', e);
    }
  }

  if (doMaterials && typeof data.api_bauxite === 'number' && (!materialsRaw || materialsRaw.length === 0)) {
    const current = getMaterials();
    if (current) {
      patchMaterials({ bauxite: data.api_bauxite });
      result.updated = true;
      console.debug('[StateExtractor] bauxite updated');
    }
  }

  if (doDecks && decksRaw.length > 0) {
    try {
      const decks = normalizeDecks(decksRaw, now);
      updateDecks(decks);
      result.updated = true;
      console.debug('[StateExtractor] decks updated:', decks.length);
    } catch (e) {
      console.warn('[StateExtractor] decks normalize failed:', e);
    }
  }

  if (doShips && shipsRaw.length > 0) {
    try {
      const ships = normalizeShips(shipsRaw, now);
      updateShips(ships);
      result.updated = true;
      console.debug('[StateExtractor] ships updated:', ships.length);
    } catch (e) {
      console.warn('[StateExtractor] ships normalize failed:', e);
    }
  }

  if (ndocksRaw.length > 0) {
    try {
      updateNdocks(normalizeNdocks(ndocksRaw, now));
      result.updated = true;
      console.debug('[StateExtractor] ndocks updated:', ndocksRaw.length);
    } catch (e) {
      console.warn('[StateExtractor] ndocks normalize failed:', e);
    }
  }

  if (kdocksRaw.length > 0) {
    try {
      updateKdocks(normalizeKdocks(kdocksRaw, now));
      result.updated = true;
      console.debug('[StateExtractor] kdocks updated:', kdocksRaw.length);
    } catch (e) {
      console.warn('[StateExtractor] kdocks normalize failed:', e);
    }
  }

  return result;
}

/**
 * 检查 API 响应中是否包含状态字段（不执行更新）
 */
export function hasStateFields(apiData: unknown): {
  hasAdmiral: boolean;
  hasMaterials: boolean;
  hasDecks: boolean;
  hasShips: boolean;
  any: boolean;
} {
  if (!apiData || typeof apiData !== 'object') {
    return { hasAdmiral: false, hasMaterials: false, hasDecks: false, hasShips: false, any: false };
  }

  const data = apiData as StateFields;

  const hasAdmiral = !!data.api_basic;
  const hasMaterials = (!!data.api_material && data.api_material.length > 0) || typeof data.api_bauxite === 'number';
  const hasDecks = rawFieldToArray<ApiDeckPortRaw>(data.api_deck_port, isDeckRaw).length > 0 ||
    rawFieldToArray<ApiDeckPortRaw>(data.api_deck_data, isDeckRaw).length > 0 ||
    rawFieldToArray<ApiDeckPortRaw>(data.api_deck, isDeckRaw).length > 0;
  const hasShips = rawFieldToArray<ApiShipRaw>(data.api_ship, isShipRaw).length > 0 ||
    rawFieldToArray<ApiShipRaw>(data.api_ship_data, isShipRaw).length > 0;
  const hasNdocks = rawFieldToArray<ApiNdockRaw>(data.api_ndock, isNdockRaw).length > 0;
  const hasKdocks = rawFieldToArray<ApiKdockRaw>(data.api_kdock, isKdockRaw).length > 0;

  return {
    hasAdmiral,
    hasMaterials,
    hasDecks,
    hasShips,
    any: hasAdmiral || hasMaterials || hasDecks || hasShips || hasNdocks || hasKdocks,
  };
}

// ==================== 便捷函数 ====================

/**
 * 从 Port API 响应中提取并更新状态
 */
export function extractFromPort(apiData: unknown): ExtractResult {
  return extractAndUpdateState(apiData, { batchUpdate: true });
}

/**
 * 从 Ship2/Ship3/ShipDeck API 响应中提取并更新状态
 */
export function extractFromShipApi(apiData: unknown): ExtractResult {
  return extractAndUpdateState(apiData, {
    updateAdmiral: false,
    updateMaterials: false,
    updateDecks: true,
    updateShips: true,
  });
}

/**
 * 从 Deck API 响应中提取并更新舰队状态
 */
export function extractFromDeckApi(apiData: unknown): ExtractResult {
  return extractAndUpdateState(apiData, {
    updateAdmiral: false,
    updateMaterials: false,
    updateDecks: true,
    updateShips: false,
  });
}

/**
 * 从 Material API 响应中提取并更新资源状态
 */
export function extractFromMaterialApi(apiData: unknown): ExtractResult {
  return extractAndUpdateState(apiData, {
    updateAdmiral: false,
    updateMaterials: true,
    updateDecks: false,
    updateShips: false,
  });
}

/**
 * 更新单艘舰船状态
 * 用于补给、入渠等场景
 */
export function updateSingleShip(shipRaw: ApiShipRaw): void {
  try {
    const ship = normalizeShip(shipRaw, Date.now());
    const manager = getGameState();
    manager.updateShip(ship);
    console.debug('[StateExtractor] single ship updated:', ship.uid);
  } catch (e) {
    console.warn('[StateExtractor] single ship normalize failed:', e);
  }
}

/**
 * 更新多艘舰船状态（增量，不清空）
 */
export function updateMultipleShips(shipsRaw: ApiShipRaw[]): void {
  if (!shipsRaw || shipsRaw.length === 0) return;

  try {
    const ships = normalizeShips(shipsRaw, Date.now());
    // 直接更新，不清空现有数据
    for (const ship of ships) {
      const manager = getGameState();
      manager.updateShip(ship, false);
    }
    // 手动触发通知
    getGameState()['notifyListeners']?.('ships');
    console.debug('[StateExtractor] multiple ships updated:', ships.length);
  } catch (e) {
    console.warn('[StateExtractor] multiple ships normalize failed:', e);
  }
}
