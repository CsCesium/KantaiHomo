/**
 * DAO Index - 纯数据访问层
 *
 * 职责：
 * 1. SQL 执行
 * 2. ResultSet → Row 转换
 *
 */

// 复杂实体 (带 Master 表 JOIN)
export * as ShipDao from './ship';
export * as SlotItemDao from './slotitem';

// 简单实体
export * as AdmiralDao from './admiral';
export * as MaterialsDao from './materials';
export * as DeckDao from './deck';
export * as QuestDao from './quest';
export * as KdockDao from './k_dock';
export * as NdockDao from './n_dock';
export * as ExpeditionDao from './expedition';
export * as BattleDao from './battle';
export * as SortieDao from './sortie';