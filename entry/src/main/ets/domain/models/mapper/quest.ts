/**
 * Quest Mapper - 统一数据层转换
 * Struct (业务层) <-> Row (存储层) 双向映射
 */

import { Quest } from '../struct/quest';
import type { QuestRow, QuestRowWrite, QuestState as QuestStateRow } from '../../../infra/storage/repo/types';

// 状态映射
type QuestStateStruct = 'inactive' | 'active' | 'complete';

function stateToRow(state: QuestStateStruct): QuestStateRow {
  return state;
}

function rowToState(state: QuestStateRow): QuestStateStruct {
  return state;
}

/**
 * 将 Quest struct 转换为 QuestRowWrite（用于存储）
 */
export function questToRow(quest: Quest): QuestRowWrite {
  return {
    questId: quest.questId,
    category: quest.category,
    type: quest.type,
    state: stateToRow(quest.state),
    title: quest.title,
    detail: quest.detail,
    progress: quest.progress,
    bonusFlag: quest.bonusFlag,
    materials: quest.materials,
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
    state: rowToState(row.state),
    title: row.title,
    detail: row.detail,
    progress: row.progress,
    bonusFlag: row.bonusFlag,
    materials: row.materials,
    updatedAt: row.updatedAt,
  };
}

/**
 * 批量转换
 */
export function questsToRows(quests: readonly Quest[]): QuestRowWrite[] {
  return quests.map(questToRow);
}

export function rowsToQuests(rows: readonly QuestRow[]): Quest[] {
  return rows.map(rowToQuest);
}
