import { KdockState } from "../api/k_dock";

export type { KdockState };

export interface Kdock {
  dockId: number;
  state: KdockState;
  createdShipMasterId: number;
  completeTime: number;
  completeTimeStr: string;
  cost: { fuel: number; ammo: number; steel: number; bauxite: number; dev: number };
  updatedAt: number;
}

export interface GetShipResult {
  newShipUid: number;
  shipName?: string;
  shipType?: string;
  kdocks?: Kdock[];
  updatedAt: number;
  extras?: Record<string, unknown>;
}