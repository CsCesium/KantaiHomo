import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { QuestRow, QuestStateDb } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): QuestRow => ({
  questId: int(rs, 'questId') ?? 0,
  category: int(rs, 'category') ?? 0,
  type: int(rs, 'type') ?? 0,
  state: (int(rs, 'state') ?? 0) as QuestStateDb,
  title: str(rs, 'title') ?? '',
  detail: str(rs, 'detail') ?? '',
  progress: int(rs, 'progress'),
  bonusFlag: int(rs, 'bonusFlag'),
  materialsJson: str(rs, 'materialsJson'),
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: readonly QuestRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO quests
         (questId, category, type, state, title, detail, progress, bonusFlag, materialsJson, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.questId, r.category, r.type, r.state,
          r.title, r.detail, r.progress, r.bonusFlag, r.materialsJson,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function list(): Promise<QuestRow[]> {
  const rs = await query(`SELECT * FROM quests ORDER BY questId ASC`, []);
  return readRows(rs, mapRow);
}

export async function get(questId: number): Promise<QuestRow | null> {
  const rs = await query(`SELECT * FROM quests WHERE questId = ? LIMIT 1`, [questId]);
  return readOne(rs, mapRow);
}

export async function listByState(state: QuestStateDb): Promise<QuestRow[]> {
  const rs = await query(`SELECT * FROM quests WHERE state = ? ORDER BY questId ASC`, [state]);
  return readRows(rs, mapRow);
}
