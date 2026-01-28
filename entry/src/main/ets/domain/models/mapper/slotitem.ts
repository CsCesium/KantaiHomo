import {
  SlotItem,
  SlotItemMaster,
  SlotItemMajorType,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemAircraftCategory
} from '../struct/slotitem';
import type {
  SlotItemRow,
  SlotItemRowWrite,
  SlotItemMasterRow,
  SlotItemMasterRowWrite,
  SlotItemWithMaster
} from '../../../infra/storage/repo/types';

// ==================== SlotItem Instance ====================

/**
 * 将 SlotItem struct 转换为 SlotItemRowWrite（用于存储）
 */
export function slotItemToRow(item: SlotItem): SlotItemRowWrite {
  return {
    uid: item.uid,
    masterId: item.masterId,
    locked: item.locked,
    level: item.level,
    alv: item.alv,
    updatedAt: item.updatedAt,
  };
}

/**
 * 将 SlotItemRow 转换为 SlotItem struct（用于业务层）
 */
export function rowToSlotItem(row: SlotItemRow): SlotItem {
  return {
    uid: row.uid,
    masterId: row.masterId,
    locked: row.locked,
    level: row.level,
    alv: row.alv,
    updatedAt: row.updatedAt,
  };
}

/**
 * 批量转换
 */
export function slotItemsToRows(items: readonly SlotItem[]): SlotItemRowWrite[] {
  return items.map(slotItemToRow);
}

export function rowsToSlotItems(rows: readonly SlotItemRow[]): SlotItem[] {
  return rows.map(rowToSlotItem);
}

// ==================== SlotItem Master ====================

/**
 * 将 SlotItemMaster struct 转换为 SlotItemMasterRowWrite（用于存储）
 */
export function slotItemMasterToRow(master: SlotItemMaster): SlotItemMasterRowWrite {
  return {
    id: master.id,
    sortNo: master.sortNo,
    name: master.name,

    typeMajor: master.type.major,
    typeBook: master.type.book,
    typeEquipType: master.type.equipType,
    typeIconId: master.type.iconId,
    typeAircraft: master.type.aircraft,

    rarity: master.rarity,
    range: master.range,

    stat_hp: master.stats.hp,
    stat_armor: master.stats.armor,
    stat_firepower: master.stats.firepower,
    stat_torpedo: master.stats.torpedo,
    stat_speed: master.stats.speed,
    stat_bomb: master.stats.bomb,
    stat_aa: master.stats.aa,
    stat_asw: master.stats.asw,
    stat_hit: master.stats.hit,
    stat_evasion: master.stats.evasion,
    stat_los: master.stats.los,
    stat_luck: master.stats.luck,

    broken_fuel: master.broken[0] ?? 0,
    broken_ammo: master.broken[1] ?? 0,
    broken_steel: master.broken[2] ?? 0,
    broken_bauxite: master.broken[3] ?? 0,

    cost: master.cost,
    distance: master.distance,
    useBull: master.useBull,
    gfxVersion: master.gfxVersion,

    updatedAt: master.updatedAt,
  };
}

/**
 * 将 SlotItemMasterRow 转换为 SlotItemMaster struct（用于业务层）
 */
export function rowToSlotItemMaster(row: SlotItemMasterRow): SlotItemMaster {
  return {
    id: row.id,
    sortNo: row.sortNo,
    name: row.name,

    type: {
      major: (row.typeMajor ?? 0) as SlotItemMajorType,
      book: (row.typeBook ?? 0) as SlotItemBookCategory,
      equipType: (row.typeEquipType ?? 0) as SlotItemEquipType,
      iconId: (row.typeIconId ?? 0) as SlotItemIconId,
      aircraft: (row.typeAircraft ?? 0) as SlotItemAircraftCategory,
    },

    rarity: row.rarity,
    range: row.range,

    stats: {
      hp: row.stat_hp,
      armor: row.stat_armor,
      firepower: row.stat_firepower,
      torpedo: row.stat_torpedo,
      speed: row.stat_speed,
      bomb: row.stat_bomb,
      aa: row.stat_aa,
      asw: row.stat_asw,
      hit: row.stat_hit,
      evasion: row.stat_evasion,
      los: row.stat_los,
      luck: row.stat_luck,
    },

    broken: [row.broken_fuel, row.broken_ammo, row.broken_steel, row.broken_bauxite],

    cost: row.cost,
    distance: row.distance,
    useBull: row.useBull,
    gfxVersion: row.gfxVersion,

    updatedAt: row.updatedAt,
  };
}

/**
 * 批量转换 Masters
 */
export function slotItemMastersToRows(masters: readonly SlotItemMaster[]): SlotItemMasterRowWrite[] {
  return masters.map(slotItemMasterToRow);
}

export function rowsToSlotItemMasters(rows: readonly SlotItemMasterRow[]): SlotItemMaster[] {
  return rows.map(rowToSlotItemMaster);
}

// ==================== Combined ====================

export interface SlotItemWithMasterStruct {
  item: SlotItem;
  master: SlotItemMaster | null;
}

/**
 * 转换带 Master 的 SlotItem
 */
export function rowWithMasterToStruct(row: SlotItemWithMaster): SlotItemWithMasterStruct {
  return {
    item: rowToSlotItem(row.item),
    master: row.master ? rowToSlotItemMaster(row.master) : null,
  };
}
