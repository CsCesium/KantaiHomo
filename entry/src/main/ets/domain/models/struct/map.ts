export interface SortieCell {
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  eventId: number;
  eventKind: number;
  next: number;
  isBoss?: boolean;
  bossCellNo?: number;
  updatedAt: number;
  extras?: Record<string, unknown>;
}