import type { ApiShipRaw } from './ship';
import type { ApiNdockRaw } from './n_dock';
import { ApiBasicRaw } from './basic';
import { ApiMaterialItemRaw } from './materials';
import { ApiDeckPortRaw } from './deck';

export interface ApiPortLogRaw {
  api_no: number;
  api_type: string;
  api_state: string | number;
  api_message: string;
  [k: string]: unknown;
}

export interface ApiPortRespRaw {
  api_basic: ApiBasicRaw;
  api_material: ApiMaterialItemRaw[];
  api_deck_port: ApiDeckPortRaw[];
  api_ndock: ApiNdockRaw[];
  api_ship: ApiShipRaw[];

  api_log?: ApiPortLogRaw[];
  api_combined_flag?: number;
  api_p_bgm_id?: number;
  api_parallel_quest_count?: number;

  [k: string]: unknown;
}