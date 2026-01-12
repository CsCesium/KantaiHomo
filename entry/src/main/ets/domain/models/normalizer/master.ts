import { ApiStart2RespRaw } from "../api/master";
import { MasterData } from "../struct/master";

function indexById<T extends { api_id: number }>(arr: T[] | undefined): Record<number, T> {
  const out: Record<number, T> = {};
  for (const it of arr ?? []) out[it.api_id] = it;
  return out;
}

export function normalizeMaster(raw: ApiStart2RespRaw, now: number = Date.now()): MasterData {
  return {
    shipsById: indexById(raw.api_mst_ship),
    slotItemsById: indexById(raw.api_mst_slotitem),
    missionsById: indexById(raw.api_mst_mission),
    updatedAt: now,
    extras: raw,
  };
}