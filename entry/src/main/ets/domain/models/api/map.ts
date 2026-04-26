export interface ApiMapResourceItemRaw {
  api_id?: number;
  api_item_id?: number;
  api_icon_id?: number;
  api_getcount?: number;
  api_count?: number;
  api_name?: string;

  [k: string]: unknown;
}

export interface ApiMapStartRespRaw {
  api_maparea_id: number;
  api_mapinfo_no: number;
  api_cell_id?: number;
  api_no?: number;
  api_event_id: number;
  api_event_kind: number;
  api_next: number;

  api_bosscell_no?: number;
  api_bosscomp?: number;
  api_color_no?: number;
  api_itemget?: ApiMapResourceItemRaw | ApiMapResourceItemRaw[];

  [k: string]: unknown;
}

export type ApiMapNextRespRaw = ApiMapStartRespRaw;
