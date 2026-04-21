import { int, str, getDB, readRows, readOne } from '../db';
import { relationalStore } from '@kit.ArkData';
import { ShipGraphRow } from '../types';

const TABLE = 'ship_graph_mst';

const mapRow = (rs: relationalStore.ResultSet): ShipGraphRow => ({
  id: int(rs, 'id') ?? 0,
  filename: str(rs, 'filename') ?? '',
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsertBatch(rows: readonly ShipGraphRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDB();
  await db.beginTransaction();
  try {
    for (const r of rows) {
      await db.executeSql(
        `INSERT OR REPLACE INTO ${TABLE} (id, filename, updatedAt) VALUES (?, ?, ?)`,
        [r.id, r.filename, r.updatedAt],
      );
    }
    await db.commit();
  } catch (e) {
    await db.rollBack();
    throw e;
  }
}

export async function get(id: number): Promise<ShipGraphRow | null> {
  const db = await getDB();
  const rs = await db.querySql(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  return readOne(rs, mapRow);
}

export async function listAll(): Promise<ShipGraphRow[]> {
  const db = await getDB();
  const rs = await db.querySql(`SELECT * FROM ${TABLE} ORDER BY id`, []);
  return readRows(rs, mapRow) as ShipGraphRow[];
}
