import { int, withTransaction, query, readOne, readRows } from "../db";
import { MaterialsRow, MaterialsRowWrite } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): MaterialsRow => ({
  id: int(rs, 'id') ?? 0,
  fuel: int(rs, 'fuel') ?? 0,
  ammo: int(rs, 'ammo') ?? 0,
  steel: int(rs, 'steel') ?? 0,
  bauxite: int(rs, 'bauxite') ?? 0,
  instantBuild: int(rs, 'instantBuild') ?? 0,
  instantRepair: int(rs, 'instantRepair') ?? 0,
  devMaterial: int(rs, 'devMaterial') ?? 0,
  screw: int(rs, 'screw') ?? 0,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function insert(row: MaterialsRowWrite): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT INTO materials_history
       (fuel, ammo, steel, bauxite, instantBuild, instantRepair, devMaterial, screw, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.fuel, row.ammo, row.steel, row.bauxite,
        row.instantBuild, row.instantRepair, row.devMaterial, row.screw,
        row.updatedAt,
      ]
    );
  });
}

export async function getLatest(): Promise<MaterialsRow | null> {
  const rs = await query(
    `SELECT * FROM materials_history ORDER BY updatedAt DESC, id DESC LIMIT 1`,
    []
  );
  return readOne(rs, mapRow);
}

export async function listLatest(limit: number): Promise<MaterialsRow[]> {
  const rs = await query(
    `SELECT * FROM materials_history ORDER BY updatedAt DESC, id DESC LIMIT ?`,
    [limit]
  );
  return readRows(rs, mapRow);
}

export async function listBetween(startMs: number, endMs: number, limit: number): Promise<MaterialsRow[]> {
  const rs = await query(
    `SELECT * FROM materials_history WHERE updatedAt >= ? AND updatedAt <= ? ORDER BY updatedAt ASC, id ASC LIMIT ?`,
    [startMs, endMs, limit]
  );
  return readRows(rs, mapRow);
}
