// ==================== SlotItem Instance ====================
import { SlotItemRow, SlotItemMasterRow, SlotItemJoinedRow } from "../../../infra/storage/types";
import {
  SlotItem,
  SlotItemMaster,
  SlotItemMajorType,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemAircraftCategory
} from "../struct";

export function slotItemToRow(item: SlotItem): SlotItemRow {
  return {
    uid: item.uid,
    masterId: item.masterId,
    locked: item.locked ? 1 : 0,  // boolean → number
    level: item.level ?? null,
    alv: item.alv ?? null,
    updatedAt: item.updatedAt,
  };
}

export function rowToSlotItem(row: SlotItemRow): SlotItem {
  return {
    uid: row.uid,
    masterId: row.masterId,
    locked: row.locked === 1,  // number → boolean
    level: row.level ?? undefined,
    alv: row.alv ?? undefined,
    updatedAt: row.updatedAt,
  };
}

export function slotItemsToRows(items: readonly SlotItem[]): SlotItemRow[] {
  return items.map(slotItemToRow);
}

export function rowsToSlotItems(rows: readonly SlotItemRow[]): SlotItem[] {
  return rows.map(rowToSlotItem);
}

// ==================== SlotItem Master ====================

export function slotItemMasterToRow(master: SlotItemMaster): SlotItemMasterRow {
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

    cost: master.cost ?? null,
    distance: master.distance ?? null,
    useBull: master.useBull ?? null,
    gfxVersion: master.gfxVersion ?? null,

    updatedAt: master.updatedAt,
  };
}

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

    cost: row.cost ?? undefined,
    distance: row.distance ?? undefined,
    useBull: row.useBull ?? undefined,
    gfxVersion: row.gfxVersion ?? undefined,

    updatedAt: row.updatedAt,
  };
}

export function slotItemMastersToRows(masters: readonly SlotItemMaster[]): SlotItemMasterRow[] {
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

export function joinedRowToStruct(row: SlotItemJoinedRow): SlotItemWithMasterStruct {
  const item = rowToSlotItem(row);

  const master: SlotItemMaster | null = row.mst_id != null ? {
    id: row.mst_id,
    sortNo: row.mst_sortNo ?? 0,
    name: row.mst_name ?? '',
    type: {
      major: (row.mst_typeMajor ?? 0) as SlotItemMajorType,
      book: (row.mst_typeBook ?? 0) as SlotItemBookCategory,
      equipType: (row.mst_typeEquipType ?? 0) as SlotItemEquipType,
      iconId: (row.mst_typeIconId ?? 0) as SlotItemIconId,
      aircraft: (row.mst_typeAircraft ?? 0) as SlotItemAircraftCategory,
    },
    rarity: row.mst_rarity ?? 0,
    range: row.mst_range ?? 0,
    stats: {
      hp: row.mst_stat_hp ?? 0,
      armor: row.mst_stat_armor ?? 0,
      firepower: row.mst_stat_firepower ?? 0,
      torpedo: row.mst_stat_torpedo ?? 0,
      speed: row.mst_stat_speed ?? 0,
      bomb: row.mst_stat_bomb ?? 0,
      aa: row.mst_stat_aa ?? 0,
      asw: row.mst_stat_asw ?? 0,
      hit: row.mst_stat_hit ?? 0,
      evasion: row.mst_stat_evasion ?? 0,
      los: row.mst_stat_los ?? 0,
      luck: row.mst_stat_luck ?? 0,
    },
    broken: [
      row.mst_broken_fuel ?? 0,
      row.mst_broken_ammo ?? 0,
      row.mst_broken_steel ?? 0,
      row.mst_broken_bauxite ?? 0,
    ],
    cost: row.mst_cost ?? undefined,
    distance: row.mst_distance ?? undefined,
    useBull: row.mst_useBull ?? undefined,
    gfxVersion: row.mst_gfxVersion ?? undefined,
    updatedAt: row.mst_updatedAt ?? 0,
  } : null;

  return { item, master };
}