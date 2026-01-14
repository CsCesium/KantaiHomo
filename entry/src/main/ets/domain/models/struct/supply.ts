import { ApiHokyuChargeKind } from "../api/charge";

export interface Materials4 {
  fuel: number;
  ammo: number;
  steel: number;
  bauxite: number;
}

export interface SupplyChargeRequest {
  kind: ApiHokyuChargeKind;
  shipUids: number[];
  requestedAt: number;
}
export interface ShipSupplyDelta {
  uid: number;
  fuel: number;
  ammo: number;
  onslot: number[];
  updatedAt: number;
}
export interface SupplyChargeResult {
  ships: ShipSupplyDelta[];
  materials: Materials4;
  bauxiteUsed?: number;
  updatedAt: number;
}

