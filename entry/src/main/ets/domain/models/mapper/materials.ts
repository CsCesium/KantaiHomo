/**
 * Materials Mapper - 统一数据层转换
 * Struct (业务层) <-> Row (存储层) 双向映射
 */

import { Materials } from '../struct/material';
import type { MaterialsRow, MaterialsRowWrite } from '../../../infra/storage/repo/types';

/**
 * 将 Materials struct 转换为 MaterialsRowWrite（用于存储）
 */
export function materialsToRow(mat: Materials): MaterialsRowWrite {
  return {
    fuel: mat.fuel,
    ammo: mat.ammo,
    steel: mat.steel,
    bauxite: mat.bauxite,
    instantBuild: mat.instantBuild,
    instantRepair: mat.instantRepair,
    devMaterial: mat.devMaterial,
    screw: mat.screw,
    updatedAt: mat.updatedAt,
  };
}

/**
 * 将 MaterialsRow 转换为 Materials struct（用于业务层）
 */
export function rowToMaterials(row: MaterialsRow): Materials {
  return {
    fuel: row.fuel,
    ammo: row.ammo,
    steel: row.steel,
    bauxite: row.bauxite,
    instantBuild: row.instantBuild,
    instantRepair: row.instantRepair,
    devMaterial: row.devMaterial,
    screw: row.screw,
    updatedAt: row.updatedAt,
  };
}

/**
 * 从 API 资源数组转换
 * API 返回格式: [{api_id: 1, api_value: xxx}, ...]
 */
export function apiMaterialsToStruct(
  apiMaterials: Array<{ api_id: number; api_value: number }>,
  timestamp: number = Date.now()
): Materials {
  const result: Materials = {
    fuel: 0,
    ammo: 0,
    steel: 0,
    bauxite: 0,
    instantBuild: 0,
    instantRepair: 0,
    devMaterial: 0,
    screw: 0,
    updatedAt: timestamp,
  };

  for (const mat of apiMaterials) {
    switch (mat.api_id) {
      case 1: result.fuel = mat.api_value; break;
      case 2: result.ammo = mat.api_value; break;
      case 3: result.steel = mat.api_value; break;
      case 4: result.bauxite = mat.api_value; break;
      case 5: result.instantBuild = mat.api_value; break;
      case 6: result.instantRepair = mat.api_value; break;
      case 7: result.devMaterial = mat.api_value; break;
      case 8: result.screw = mat.api_value; break;
    }
  }

  return result;
}

/**
 * 比较两个 Materials 是否相同（忽略 updatedAt）
 */
export function materialsEqual(a: Materials, b: Materials): boolean {
  return a.fuel === b.fuel
    && a.ammo === b.ammo
    && a.steel === b.steel
    && a.bauxite === b.bauxite
    && a.instantBuild === b.instantBuild
    && a.instantRepair === b.instantRepair
    && a.devMaterial === b.devMaterial
    && a.screw === b.screw;
}

/**
 * 计算资源差异
 */
export function materialsDiff(before: Materials, after: Materials): Materials {
  return {
    fuel: after.fuel - before.fuel,
    ammo: after.ammo - before.ammo,
    steel: after.steel - before.steel,
    bauxite: after.bauxite - before.bauxite,
    instantBuild: after.instantBuild - before.instantBuild,
    instantRepair: after.instantRepair - before.instantRepair,
    devMaterial: after.devMaterial - before.devMaterial,
    screw: after.screw - before.screw,
    updatedAt: after.updatedAt,
  };
}
