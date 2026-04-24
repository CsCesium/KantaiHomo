import { PayloadEvent } from './type';

export interface ChargeShipPatch {
  uid: number;
  fuel: number;
  ammo: number;
  onslot: number[];
}

export interface ChargeResult {
  ships: ChargeShipPatch[];
  fuel: number;
  ammo: number;
  steel: number;
  bauxite: number;
  updatedAt: number;
}

export type SupplyChargeEvent = PayloadEvent<'SUPPLY_CHARGE', ChargeResult>;
