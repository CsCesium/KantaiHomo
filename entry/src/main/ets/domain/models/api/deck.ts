import { ApiDeckMissionTuple } from "./mission";

export interface ApiDeckPortRaw {
  api_id: number;
  api_name: string;
  api_ship: number[];          // ship uid 列表，空位常见 -1/0
  api_mission: ApiDeckMissionTuple;
  [k: string]: unknown;
}