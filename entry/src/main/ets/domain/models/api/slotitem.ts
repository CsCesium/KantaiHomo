export interface ApiSlotItemRaw {
  api_id: number;
  api_slotitem_id: number;
  api_locked: 0|1;
  api_level?: number;
  api_alv?: number;
  [k: string]: unknown;
}

export type ApiUnsetSlotRaw = Record<string, number[]>;