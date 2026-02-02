/**
 * Quest Mapper - 统一数据层转换
 * Struct (业务层) <-> Row (存储层) 双向映射
 */

import { safeParseJsonArray } from '..';
import { QuestRow } from '../../../infra/storage/types';
import { Quest } from '../struct/quest';

/**
 * 将 Quest struct 转换为 QuestRowWrite（用于存储）
 */
export function questToRow(quest: Quest): QuestRow {
  return {
    questId: quest.questId,
    category: quest.category,
    type: quest.type,
    state: quest.state,
    title: quest.title,
    detail: quest.detail,
    progress: quest.progress?? null,
    bonusFlag: quest.bonusFlag ?? null,
    materialsJson: quest.materials ? JSON.stringify(quest.materials) : null,
    updatedAt: quest.updatedAt,
  };
}

/**
 * 将 QuestRow 转换为 Quest struct（用于业务层）
 */
export function rowToQuest(row: QuestRow): Quest {
  return {
    questId: row.questId,
    category: row.category,
    type: row.type,
    state: row.state,
    title: row.title,
    detail: row.detail,
    progress: row.progress ?? undefined,
    bonusFlag: row.bonusFlag ?? undefined,
    materials: row.materialsJson ? safeParseJsonArray(row.materialsJson) : undefined,
    updatedAt: row.updatedAt,
  };
}

/**
 * 批量转换
 */
export function questsToRows(quests: readonly Quest[]): QuestRow[] {
  return quests.map(questToRow);
}

export function rowsToQuests(rows: readonly QuestRow[]): Quest[] {
  return rows.map(rowToQuest);
}
