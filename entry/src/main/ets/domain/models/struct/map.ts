export interface MapResourceGain {
  name: string;
  count: number;
  itemId?: number;
  iconId?: number;
}

export interface SortieCell {
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  eventId: number;
  eventKind: number;
  next: number;
  isBoss?: boolean;
  bossCellNo?: number;
  colorNo?: number;
  resourceGains?: MapResourceGain[];
  updatedAt: number;
  extras?: Record<string, unknown>;
}
