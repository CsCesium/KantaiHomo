import { NdockRow } from "../../../infra/storage/types";
import { Ndock } from "../struct";

export function ndockToRow(n: Ndock): NdockRow {
  return {
    dockId: n.dockId,
    state: n.state,
    shipUid: n.shipUid,
    completeTime: n.completeTime,
    completeTimeStr: n.completeTimeStr ?? null,
    costFuel: n.cost.fuel,
    costSteel: n.cost.steel,
    updatedAt: n.updatedAt,
  };
}

export function rowToNdock(row: NdockRow): Ndock {
  return {
    dockId: row.dockId,
    state: row.state,
    shipUid: row.shipUid,
    completeTime: row.completeTime,
    completeTimeStr: row.completeTimeStr ?? undefined,
    cost: { fuel: row.costFuel, steel: row.costSteel },
    updatedAt: row.updatedAt,
  };
}

export function ndocksToRows(ndocks: readonly Ndock[]): NdockRow[] {
  return ndocks.map(ndockToRow);
}

export function rowsToNdocks(rows: readonly NdockRow[]): Ndock[] {
  return rows.map(rowToNdock);
}