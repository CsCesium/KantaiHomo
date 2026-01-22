export type ApiMstStatLike = number | number[];

export interface ApiMstSlotItemRaw {
  api_id: number;
  api_sortno: number;
  api_name: string;

  api_type: number[];

  api_taik: ApiMstStatLike;
  api_souk: ApiMstStatLike;
  api_houg: ApiMstStatLike;
  api_raig: ApiMstStatLike;
  api_soku: ApiMstStatLike;
  api_baku: ApiMstStatLike;
  api_tyku: ApiMstStatLike;
  api_tais: ApiMstStatLike;

  api_atap?: ApiMstStatLike;
  api_houm: ApiMstStatLike;
  api_raim?: ApiMstStatLike;
  api_houk: ApiMstStatLike;
  api_raik?: ApiMstStatLike;
  api_bakk?: ApiMstStatLike;

  api_saku: ApiMstStatLike;
  api_sakb?: ApiMstStatLike;
  api_luck: ApiMstStatLike;

  api_leng: number;
  api_rare: number;

  api_cost?: number;
  api_distance?: number;

  api_broken: number[];

  api_usebull?: number;
  api_version?: number;

  [k: string]: unknown;
}
