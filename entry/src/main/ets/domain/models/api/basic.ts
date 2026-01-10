export interface ApiBasicRaw {
  api_member_id: number;
  api_nickname: string;
  api_level: number;
  api_experience: number;

  api_max_chara: number;
  api_max_slotitem: number;

  api_rank?: number;
  api_large_dock?: 0 | 1;

  [k: string]: unknown;
}