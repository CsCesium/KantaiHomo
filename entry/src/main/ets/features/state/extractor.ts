// ==================== 类型定义 ====================
import { updateFromPort, updateAdmiral, updateMaterials, updateDecks, updateShips, updateSlotItemIndex, getGameState } from ".";
import {
  ApiBasicRaw,
  ApiMaterialItemRaw,
  ApiDeckPortRaw,
  ApiShipRaw,
  normalizeAdmiral,
  normalizeMaterials,
  normalizeDecks,
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

  // 舰队 (port 使用 api_deck_port, 其他使用 api_deck_data)
  api_deck_port?: ApiDeckPortRaw[];
  api_deck_data?: ApiDeckPortRaw[];

  // 舰船 (port 使用 api_ship, ship2/ship3 使用 api_ship_data)
  api_ship?: ApiShipRaw[];
  api_ship_data?: ApiShipRaw[];

  // 装备实例列表
  api_slot_item?: ApiSlotItemRaw[];

  // 允许其他字段
  [key: string]: unknown;
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
  const decksRaw = data.api_deck_port ?? data.api_deck_data;
  const shipsRaw = data.api_ship ?? data.api_ship_data;

  result.hasAdmiral = !!admiralRaw;
  result.hasMaterials = !!materialsRaw && materialsRaw.length > 0;
  result.hasDecks = !!decksRaw && decksRaw.length > 0;
  result.hasShips = !!shipsRaw && shipsRaw.length > 0;

  // 提取装备实例索引（无论哪种模式都执行）
  const slotItemsRaw = data.api_slot_item;
  if (slotItemsRaw && slotItemsRaw.length > 0) {
    try {
      const indexItems = slotItemsRaw.map(r => ({ uid: r.api_id, masterId: r.api_slotitem_id }));
      updateSlotItemIndex(indexItems);
      console.debug('[StateExtractor] slotitem index updated:', indexItems.length);
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
    if (doDecks && decksRaw) {
      portData.decks = normalizeDecks(decksRaw, now);
    }
    if (doShips && shipsRaw) {
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
      updateMaterials(materials);
      result.updated = true;
      console.debug('[StateExtractor] materials updated');
    } catch (e) {
      console.warn('[StateExtractor] materials normalize failed:', e);
    }
  }

  if (doDecks && decksRaw && decksRaw.length > 0) {
    try {
      const decks = normalizeDecks(decksRaw, now);
      updateDecks(decks);
      result.updated = true;
      console.debug('[StateExtractor] decks updated:', decks.length);
    } catch (e) {
      console.warn('[StateExtractor] decks normalize failed:', e);
    }
  }

  if (doShips && shipsRaw && shipsRaw.length > 0) {
    try {
      const ships = normalizeShips(shipsRaw, now);
      updateShips(ships);
      result.updated = true;
      console.debug('[StateExtractor] ships updated:', ships.length);
    } catch (e) {
      console.warn('[StateExtractor] ships normalize failed:', e);
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
  const hasMaterials = !!data.api_material && data.api_material.length > 0;
  const hasDecks = !!(data.api_deck_port ?? data.api_deck_data);
  const hasShips = !!(data.api_ship ?? data.api_ship_data);

  return {
    hasAdmiral,
    hasMaterials,
    hasDecks,
    hasShips,
    any: hasAdmiral || hasMaterials || hasDecks || hasShips,
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
