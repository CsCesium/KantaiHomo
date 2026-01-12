import { ApiMaterialItemRaw, MaterialId } from "../api/materials";
import { Materials } from "../struct/material";

export function normalizeMaterials(raw: ApiMaterialItemRaw[], now: number = Date.now()): Materials {
  const map: Partial<Record<MaterialId, number>> = {};
  for (const it of raw ?? []) map[it.api_id] = it.api_value ?? 0;

  return {
    fuel: map[1] ?? 0,
    ammo: map[2] ?? 0,
    steel: map[3] ?? 0,
    bauxite: map[4] ?? 0,
    instantBuild: map[5] ?? 0,
    instantRepair: map[6] ?? 0,
    devMaterial: map[7] ?? 0,
    screw: map[8] ?? 0,
    updatedAt: now,
  };
}