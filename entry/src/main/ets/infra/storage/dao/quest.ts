import type { QuestRow as RepoQuestRow, QuestState } from '../../storage/repo/types';
import { int, str, withTransaction, query, readRows, readOne } from '../db';
import { relationalStore } from '@kit.ArkData';

export type QuestDbRow =
  Omit<RepoQuestRow, 'state' | 'progress' | 'bonusFlag' | 'materials'> & {
    state: number;                 // 0/1/2
    progress: number | null;
    bonusFlag: number | null;
    materialsJson: string | null;  // JSON number[]
  };

const mapQuest = (rs: relationalStore.ResultSet): QuestDbRow => ({
  questId: int(rs, 'questId') ?? 0,
  category: int(rs, 'category') ?? 0,
  type: int(rs, 'type') ?? 0,
  state: int(rs, 'state') ?? 0,
  title: str(rs, 'title') ?? '',
  detail: str(rs, 'detail') ?? '',
  progress: int(rs, 'progress') ?? null,
  bonusFlag: int(rs, 'bonusFlag') ?? null,
  materialsJson: str(rs, 'materialsJson') ?? null,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: QuestDbRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO quests
         (questId, category, type, state, title, detail, progress, bonusFlag, materialsJson, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.questId,
          r.category,
          r.type,
          r.state,
          r.title,
          r.detail,
          r.progress,
          r.bonusFlag,
          r.materialsJson,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function listQuests(): Promise<QuestDbRow[]> {
  const rs = await query(
    `SELECT questId, category, type, state, title, detail, progress, bonusFlag, materialsJson, updatedAt
     FROM quests
     ORDER BY questId ASC`,
    []
  );
  return readRows(rs, mapQuest);
}

export async function getQuest(questId: number): Promise<QuestDbRow | null> {
  const rs = await query(
    `SELECT questId, category, type, state, title, detail, progress, bonusFlag, materialsJson, updatedAt
     FROM quests
     WHERE questId = ?
     LIMIT 1`,
    [questId]
  );
  return readOne(rs, mapQuest);
}

export async function listQuestsByState(state: number): Promise<QuestDbRow[]> {
  const rs = await query(
    `SELECT questId, category, type, state, title, detail, progress, bonusFlag, materialsJson, updatedAt
     FROM quests
     WHERE state = ?
     ORDER BY questId ASC`,
    [state]
  );
  return readRows(rs, mapQuest);
}