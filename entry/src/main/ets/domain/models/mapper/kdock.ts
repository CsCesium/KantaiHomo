import { KdockRow } from "../../../infra/storage/types";
import { Kdock } from "../struct";

export function kdockToRow(k: Kdock): KdockRow {
  return {
    dockId: k.dockId,
    state: k.state,
    createdShipMasterId: k.createdShipMasterId,
    completeTime: k.completeTime,
    completeTimeStr: k.completeTimeStr,
    costFuel: k.cost.fuel,
    costAmmo: k.cost.ammo,
    costSteel: k.cost.steel,
    costBauxite: k.cost.bauxite,
    costDev: k.cost.dev,
    updatedAt: k.updatedAt,
  };
}

export function rowToKdock(row: KdockRow): Kdock {
  return {
    dockId: row.dockId,
    state: row.state,
    createdShipMasterId: row.createdShipMasterId,
    completeTime: row.completeTime,
    completeTimeStr: row.completeTimeStr,
    cost: {
      fuel: row.costFuel,
      ammo: row.costAmmo,
      steel: row.costSteel,
      bauxite: row.costBauxite,
      dev: row.costDev,
    },
    updatedAt: row.updatedAt,
  };
}

export function kdocksToRows(kdocks: readonly Kdock[]): KdockRow[] {
  return kdocks.map(kdockToRow);
}

export function rowsToKdocks(rows: readonly KdockRow[]): Kdock[] {
  return rows.map(rowToKdock);
}
