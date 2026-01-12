import { ApiGetShipRespRaw, ApiKdockRaw } from "../api/k_dock";
import { GetShipResult, Kdock } from "../struct/k_dock";

export function normalizeKdock(raw: ApiKdockRaw, now: number = Date.now()): Kdock {
  return {
    dockId: raw.api_id,
    state: raw.api_state,
    createdShipMasterId: raw.api_created_ship_id ?? 0,
    completeTime: raw.api_complete_time ?? 0,
    completeTimeStr: raw.api_complete_time_str ?? '',
    cost: {
      fuel: raw.api_item1 ?? 0,
      ammo: raw.api_item2 ?? 0,
      steel: raw.api_item3 ?? 0,
      bauxite: raw.api_item4 ?? 0,
      dev: raw.api_item5 ?? 0,
    },
    updatedAt: now,
  };
}

export function normalizeKdocks(raw: ApiKdockRaw[], now: number = Date.now()): Kdock[] {
  return (raw ?? []).map((x) => normalizeKdock(x, now));
}

export function normalizeGetShipResult(raw: ApiGetShipRespRaw, now: number = Date.now()): GetShipResult {
  return {
    newShipUid: raw.api_ship_id,
    shipName: raw.api_ship_name ?? undefined,
    shipType: raw.api_ship_type ?? undefined,
    kdocks: raw.api_kdock ? normalizeKdocks(raw.api_kdock, now) : undefined,
    updatedAt: now,
    extras: raw,
  };
}