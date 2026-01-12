export interface ApiQuestListItemRaw {
  api_no: number;
  api_category: number;
  api_type: number;
  api_state: 1|2|3;
  api_title: string;
  api_detail: string;
  api_bonus_flag?: number;
  api_progress_flag?: number;
  api_get_material?: number[];
  api_select_rewards?: Array<{
    api_no: number;
    api_kind: number;
    api_mst_id: number;
    api_count: number;
  }>;
  [k: string]: unknown;
}

export interface ApiQuestListRespRaw {
  api_count: number;
  api_completed_kind: number;
  api_page_count: number;
  api_disp_page: number;
  api_list: ApiQuestListItemRaw[] | null;
  [k: string]: unknown;
}