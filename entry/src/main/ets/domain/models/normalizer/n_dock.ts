import { ApiNdockRaw } from "../api/n_dock";
import { Ndock } from "../struct/n_dock";

export function normalizeNdock(raw: ApiNdockRaw, now: number = Date.now()): Ndock {
  return {
    dockId: raw.api_id,
    state: raw.api_state,
    shipUid: raw.api_ship_id,
    completeTime: raw.api_complete_time ?? 0,
    completeTimeStr: raw.api_complete_time_str ?? undefined,
    cost: { fuel: raw.api_item1 ?? 0, steel: raw.api_item3 ?? 0 },
    updatedAt: now,
  };
}

export function normalizeNdocks(raw: ApiNdockRaw[], now: number = Date.now()): Ndock[] {
  return (raw ?? []).map((x) => normalizeNdock(x, now));
}