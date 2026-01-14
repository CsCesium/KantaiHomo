import { ApiResponse } from "..";

export enum ApiHokyuChargeKind {
  FUEL = 1,
  AMMO = 2,
  ALL = 3,
}

export interface ApiHokyuChargeReqRaw {
  api_kind: ApiHokyuChargeKind;
  api_id_items: string;
}

export interface ApiHokyuChargeShipRaw {
  /** 舰船固有ID（api_port/port 的 api_ship.api_id） */
  api_id: number;
  /** 补给后的燃料（当前值） */
  api_fuel: number;
  /** 补给后的弹药（当前值） */
  api_bull: number;
  /** 补给后的舰载机当前搭载数（与槽位对应） */
  api_onslot: number[];
}
export type ApiMaterial4Raw = [fuel: number, ammo: number, steel: number, bauxite: number];

export interface ApiHokyuChargeDataRaw {
  api_ship: ApiHokyuChargeShipRaw[];
  api_material: ApiMaterial4Raw;
  api_use_bou?: number;
}

export type ApiHokyuChargeRespRaw = ApiResponse<ApiHokyuChargeDataRaw>;