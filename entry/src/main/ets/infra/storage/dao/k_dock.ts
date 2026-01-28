import { int, str, withTransaction, query, readRows, readOne } from "../db";
import { KdockRow } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): KdockRow => ({
  dockId: int(rs, 'dockId') ?? 0,
  state: (int(rs, 'state') ?? 0) as any,
  createdShipMasterId: int(rs, 'createdShipMasterId') ?? 0,
  completeTime: int(rs, 'completeTime') ?? 0,
  completeTimeStr: str(rs, 'completeTimeStr') ?? '',
  costFuel: int(rs, 'costFuel') ?? 0,
  costAmmo: int(rs, 'costAmmo') ?? 0,
  costSteel: int(rs, 'costSteel') ?? 0,
  costBauxite: int(rs, 'costBauxite') ?? 0,
  costDev: int(rs, 'costDev') ?? 0,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: readonly KdockRow[]): Promise<void> {
  if (!rows.length) return;
  await withTransaction(async (db) => {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO kdocks
         (dockId, state, createdShipMasterId, completeTime, completeTimeStr,
          costFuel, costAmmo, costSteel, costBauxite, costDev, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.dockId, r.state, r.createdShipMasterId, r.completeTime, r.completeTimeStr,
          r.costFuel, r.costAmmo, r.costSteel, r.costBauxite, r.costDev,
          r.updatedAt,
        ]
      );
    }
  });
}

export async function list(): Promise<KdockRow[]> {
  const rs = await query(`SELECT * FROM kdocks ORDER BY dockId ASC`, []);
  return readRows(rs, mapRow);
}

export async function get(dockId: number): Promise<KdockRow | null> {
  const rs = await query(`SELECT * FROM kdocks WHERE dockId = ? LIMIT 1`, [dockId]);
  return readOne(rs, mapRow);
}
