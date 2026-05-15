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

const mapFullRow = (rs: relationalStore.ResultSet): MissionRow => ({
  id: int(rs, 'id') ?? 0,
  code: str(rs, 'code'),
  mapAreaId: int(rs, 'mapAreaId'),
  name: str(rs, 'name') ?? '',
  details: str(rs, 'details'),
  resetType: str(rs, 'resetType'),
  damageType: int(rs, 'damageType'),
  timeMin: int(rs, 'timeMin'),
  requireShips: int(rs, 'requireShips'),
  difficulty: int(rs, 'difficulty'),
  fuelPct: int(rs, 'fuelPct'),
  ammoPct: int(rs, 'ammoPct'),
  reward_item1_id: int(rs, 'reward_item1_id'),
  reward_item1_count: int(rs, 'reward_item1_count'),
  reward_item2_id: int(rs, 'reward_item2_id'),
  reward_item2_count: int(rs, 'reward_item2_count'),
  mat0: int(rs, 'mat0'),
  mat1: int(rs, 'mat1'),
  mat2: int(rs, 'mat2'),
  mat3: int(rs, 'mat3'),
  returnCancelable: int(rs, 'returnCancelable'),
  sampleFleet: str(rs, 'sampleFleet'),
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

/** 查询所有远征任务的完整字段，按 id 升序。供远征信息页使用。 */
export async function listAll(): Promise<MissionRow[]> {
  const rs = await query(`SELECT * FROM missions ORDER BY id ASC`, []);
  return readRows(rs, mapFullRow) as MissionRow[];
}
