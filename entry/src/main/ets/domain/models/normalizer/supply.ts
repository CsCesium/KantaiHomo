import { ApiHokyuChargeDataRaw, ApiHokyuChargeReqRaw, ApiMaterial4Raw } from "../api/charge";
import { Materials4, ShipSupplyDelta, SupplyChargeRequest, SupplyChargeResult } from "../struct/supply";

export function normalizeMaterials4(raw: ApiMaterial4Raw | number[] | undefined): Materials4 {
  const a = raw ?? [];
  return {
    fuel: Number(a[0] ?? 0),
    ammo: Number(a[1] ?? 0),
    steel: Number(a[2] ?? 0),
    bauxite: Number(a[3] ?? 0),
  };
}

export function normalizeChargeRequest(raw: ApiHokyuChargeReqRaw): SupplyChargeRequest {
  const shipUids = String(raw.api_id_items ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s))
    .filter(n => Number.isFinite(n) && n > 0);

  return {
    kind: raw.api_kind,
    shipUids,
    requestedAt: Date.now(),
  };
}

export function normalizeChargeResult(raw: ApiHokyuChargeDataRaw): SupplyChargeResult {
  const updatedAt = Date.now();
  const ships: ShipSupplyDelta[] = (raw.api_ship ?? []).map(s => ({
    uid: s.api_id,
    fuel: s.api_fuel ?? 0,
    ammo: s.api_bull ?? 0,
    onslot: s.api_onslot ?? [],
    updatedAt,
  }));

  return {
    ships,
    materials: normalizeMaterials4(raw.api_material as ApiMaterial4Raw),
    bauxiteUsed: raw.api_use_bou ?? undefined,
    updatedAt,
  };
}
