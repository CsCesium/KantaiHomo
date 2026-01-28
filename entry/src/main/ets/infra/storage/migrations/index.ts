import type relationalStore from '@ohos.data.relationalStore';

export interface Migration {
  version: number;
  name: string;
  up(db: relationalStore.RdbStore): Promise<void>;
  down?(db: relationalStore.RdbStore):Promise<void>;
}

/**
 * 所有 migrations 列表
 * 按版本号顺序排列，确保版本号唯一且递增
 */
import m001 from './001_init_core';
import m002 from './002_add_missions';
import m003 from './003_add_expedition_results';
import m004 from './004_add_port';
import m005 from './005_create_materials';
import m006 from './006_create_slotitems';
import m007 from './007_create_ships';
import m008 from './008_create_deck';
import m009 from './009_create_quest';
import m010 from './010_create_k_dock';
import m011 from './011_create_n_dock';
import m012 from './012_create_battle'

export const migrations: Migration[] = [
  m001,  // v1 - expeditions 表
  m002,  // v2 - missions 表
  m003,  // v3 - expedition_results 表
  m004,  // v4 - admirals 表
  m005,  // v5 - materials 表
  m006,  // v6 - slotitem_mst, slotitems 表
  m007,  // v7 - ship_mst, ships 表
  m008,  // v8 - decks 表
  m009,  // v9 - quests 表
  m010,  // v10 - kdocks 表
  m011,  // v11 - ndocks 表
  m012,  //v12 - battle 表
];

// 导出单个 migration（可选用于测试）
export { m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011 };
