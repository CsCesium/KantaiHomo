import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { NdockRow } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): NdockRow => ({
  dockId: int(rs, 'dockId') ?? 0,
  state: int(rs, 'state') ?? 0,
  shipUid: int(rs, 'shipUid') ?? 0,
  completeTime: int(rs, 'completeTime') ?? 0,
  completeTimeStr: str(rs, 'completeTimeStr'),
  costFuel: int(rs, 'costFuel') ?? 0,
  costSteel: int(rs, 'costSteel') ?? 0,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: readonly NdockRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO ndocks
         (dockId, state, shipUid, completeTime, completeTimeStr, costFuel, costSteel, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.dockId, r.state, r.shipUid, r.completeTime, r.completeTimeStr,
          r.costFuel, r.costSteel, r.updatedAt,
        ]
      );
    }
  });
}

export async function list(): Promise<NdockRow[]> {
  const rs = await query(`SELECT * FROM ndocks ORDER BY dockId ASC`, []);
  return readRows(rs, mapRow);
}

export async function get(dockId: number): Promise<NdockRow | null> {
  const rs = await query(`SELECT * FROM ndocks WHERE dockId = ? LIMIT 1`, [dockId]);
  return readOne(rs, mapRow);
}

export async function getNextAfter(nowMs: number): Promise<{ dockId: number; shipUid: number; completeTime: number } | null> {
  const rs = await query(
    `SELECT dockId, shipUid, completeTime FROM ndocks WHERE completeTime > ? ORDER BY completeTime ASC LIMIT 1`,
    [nowMs]
  );
  return readOne(rs, (r) => ({
    dockId: int(r, 'dockId') ?? 0,
    shipUid: int(r, 'shipUid') ?? 0,
    completeTime: int(r, 'completeTime') ?? 0,
  }));
}
