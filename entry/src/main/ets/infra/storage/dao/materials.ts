import { int, withTransaction, query, readOne } from "../db";
import { relationalStore } from "@kit.ArkData";

export interface MaterialsRow {
  memberId: number;
  fuel: number;
  ammo: number;
  steel: number;
  bauxite: number;
  instantBuild: number;
  instantRepair: number;
  devMaterial: number;
  screw: number;
  updatedAt: number;
}

const mapMaterials = (rs: relationalStore.ResultSet): MaterialsRow => ({
  memberId: int(rs, 'memberId') ?? 0,
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

export async function upsert(row: MaterialsRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT OR REPLACE INTO materials
       (memberId, fuel, ammo, steel, bauxite, instantBuild, instantRepair, devMaterial, screw, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.memberId,
        row.fuel,
        row.ammo,
        row.steel,
        row.bauxite,
        row.instantBuild,
        row.instantRepair,
        row.devMaterial,
        row.screw,
        row.updatedAt,
      ]
    );
  });
}

export async function getMaterials(memberId: number): Promise<MaterialsRow | null> {
  const rs = await query(
    `SELECT memberId, fuel, ammo, steel, bauxite, instantBuild, instantRepair, devMaterial, screw, updatedAt
     FROM materials
     WHERE memberId = ?
     LIMIT 1`,
    [memberId]
  );
  return readOne(rs, mapMaterials);
}

export async function getLatestMaterials(): Promise<MaterialsRow | null> {
  const rs = await query(
    `SELECT memberId, fuel, ammo, steel, bauxite, instantBuild, instantRepair, devMaterial, screw, updatedAt
     FROM materials
     ORDER BY updatedAt DESC
     LIMIT 1`,
    []
  );
  return readOne(rs, mapMaterials);
}