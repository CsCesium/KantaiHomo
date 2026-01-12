export type KdockState = 0|1|2|3;

export interface ApiKdockRaw {
  api_id: number;
  api_state: KdockState;
  api_created_ship_id: number;
  api_complete_time: number;
  api_complete_time_str: string;
  api_item1: number;
  api_item2: number;
  api_item3: number;
  api_item4: number;
  api_item5: number;

  [k: string]: unknown;
}

export interface ApiGetShipRespRaw {
  api_ship_id: number;
  api_ship_type?: string;
  api_ship_name?: string;
  api_kdock?: ApiKdockRaw[];
  [k: string]: unknown;
}