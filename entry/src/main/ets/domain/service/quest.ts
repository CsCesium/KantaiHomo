/**
 * Quest Service - 处理任务相关业务逻辑
 */

import { Quest, QuestListPage } from '../models/struct/quest';
import { QuestCategory, QuestResetType, isRecurringQuest, QuestState } from '../models/enums/quest';
import { questsToRows, rowsToQuests } from '../models/mapper/quest';
import { getRepositoryHub } from '../../infra/storage/repo';

/**
 * 保存任务列表页
 */
export async function saveQuestListPage(page: QuestListPage): Promise<void> {
  const hub = getRepositoryHub();

  if (page.quests.length > 0) {
    const rows = questsToRows(page.quests);
    await hub.quest.upsertBatch(rows);
  }
}

/**
 * 保存单个任务
 */
export async function saveQuest(quest: Quest): Promise<void> {
  const hub = getRepositoryHub();
  const rows = questsToRows([quest]);
  await hub.quest.upsertBatch(rows);
}

/**
 * 批量保存任务
 */
export async function saveQuests(quests: Quest[]): Promise<void> {
  if (quests.length === 0) return;

  const hub = getRepositoryHub();
  const rows = questsToRows(quests);
  await hub.quest.upsertBatch(rows);
}

/**
 * 获取所有任务
 */
export async function getAllQuests(): Promise<Quest[]> {
  const hub = getRepositoryHub();
  const rows = await hub.quest.list();
  return rowsToQuests(rows);
}

/**
 * 获取进行中的任务
 */
export async function getActiveQuests(): Promise<Quest[]> {
  const hub = getRepositoryHub();
  const rows = await hub.quest.listByState(QuestState.ACTIVE);
  return rowsToQuests(rows);
}

/**
 * 获取已完成的任务
 */
export async function getCompletedQuests(): Promise<Quest[]> {
  const hub = getRepositoryHub();
  const rows = await hub.quest.listByState(QuestState.COMPLETE);
  return rowsToQuests(rows);
}

/**
 * 按分类获取任务
 */
export async function getQuestsByCategory(category: QuestCategory): Promise<Quest[]> {
  const all = await getAllQuests();
  return all.filter(q => q.category === category);
}

/**
 * 获取每日任务
 */
export async function getDailyQuests(): Promise<Quest[]> {
  const all = await getAllQuests();
  return all.filter(q => q.type === QuestResetType.DAILY);
}

/**
 * 获取每周任务
 */
export async function getWeeklyQuests(): Promise<Quest[]> {
  const all = await getAllQuests();
  return all.filter(q => q.type === QuestResetType.WEEKLY);
}

/**
 * 获取每月任务
 */
export async function getMonthlyQuests(): Promise<Quest[]> {
  const all = await getAllQuests();
  return all.filter(q =>
  q.type === QuestResetType.MONTHLY ||
    q.type === QuestResetType.MONTHLY_2 ||
    q.type === QuestResetType.MONTHLY_3
  );
}

/**
 * 根据任务 ID 获取任务
 */
export async function getQuestById(questId: number): Promise<Quest | null> {
  const hub = getRepositoryHub();
  const row = await hub.quest.get(questId);
  if (!row) return null;
  return rowsToQuests([row])[0];
}

/**
 * 统计任务数量
 */
export interface QuestStats {
  total: number;
  active: number;
  completed: number;
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
  oneTime: number;
}

export async function getQuestStats(): Promise<QuestStats> {
  const all = await getAllQuests();

  return {
    total: all.length,
    active: all.filter(q => q.state === QuestState.ACTIVE).length,
    completed: all.filter(q => q.state === QuestState.COMPLETE).length,
    daily: all.filter(q => q.type === QuestResetType.DAILY).length,
    weekly: all.filter(q => q.type === QuestResetType.WEEKLY).length,
    monthly: all.filter(q =>
    q.type === QuestResetType.MONTHLY ||
      q.type === QuestResetType.MONTHLY_2 ||
      q.type === QuestResetType.MONTHLY_3
    ).length,
    quarterly: all.filter(q => q.type === QuestResetType.QUARTERLY).length,
    yearly: all.filter(q =>
    q.type === QuestResetType.YEARLY_FEB ||
      q.type === QuestResetType.YEARLY_AUG ||
      q.type === QuestResetType.YEARLY_MAR ||
      q.type === QuestResetType.YEARLY_SEP
    ).length,
    oneTime: all.filter(q => q.type === QuestResetType.ONCE).length,
  };
}
