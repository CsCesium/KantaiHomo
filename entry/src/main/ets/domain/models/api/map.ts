export interface ApiMapStartRespRaw {
  api_maparea_id: number;
  api_mapinfo_no: number;
  api_cell_id: number;
  api_event_id: number;
  api_event_kind: number;
  api_next: number;

  api_bosscell_no?: number;
  api_bosscomp?: number;
  api_color_no?: number;

  [k: string]: unknown;
}

export type ApiMapNextRespRaw = ApiMapStartRespRaw;