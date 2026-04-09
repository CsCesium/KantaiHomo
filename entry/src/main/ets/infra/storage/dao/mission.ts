import { query, withTransaction, readRows, int, str } from '../db';
import type relationalStore from '@ohos.data.relationalStore';
import { MissionRow } from '../types';

const mapIdName = (rs: relationalStore.ResultSet): { id: number; name: string } => ({
  id: int(rs, 'id') ?? 0,
  name: str(rs, 'name') ?? '',
});

export async function upsertBatch(rows: readonly MissionRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO missions
         (id, code, mapAreaId, name, details, resetType, damageType, timeMin,
          requireShips, difficulty, fuelPct, ammoPct,
          reward_item1_id, reward_item1_count, reward_item2_id, reward_item2_count,
          mat0, mat1, mat2, mat3, returnCancelable, sampleFleet, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.code, r.mapAreaId, r.name, r.details, r.resetType, r.damageType, r.timeMin,
          r.requireShips, r.difficulty, r.fuelPct, r.ammoPct,
          r.reward_item1_id, r.reward_item1_count, r.reward_item2_id, r.reward_item2_count,
          r.mat0, r.mat1, r.mat2, r.mat3, r.returnCancelable, r.sampleFleet, r.updatedAt,
        ]
      );
    }
  });
}

/** 仅查询 id + name，用于 diff 检查 */
export async function listIdNames(): Promise<ReadonlyArray<{ id: number; name: string }>> {
  const rs = await query(`SELECT id, name FROM missions ORDER BY id ASC`, []);
  return readRows(rs, mapIdName);
}
