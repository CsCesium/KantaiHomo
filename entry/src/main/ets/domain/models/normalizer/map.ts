import { ApiMapStartRespRaw, ApiMapNextRespRaw } from "../api/map";
import { SortieCell } from "../struct/map";

export function normalizeSortieCell(raw: ApiMapStartRespRaw | ApiMapNextRespRaw, now: number = Date.now()): SortieCell {
  return {
    mapAreaId: raw.api_maparea_id,
    mapInfoNo: raw.api_mapinfo_no,
    cellId: raw.api_cell_id,
    eventId: raw.api_event_id,
    eventKind: raw.api_event_kind,
    next: raw.api_next,
    isBoss: raw.api_bosscomp === 1 ? true : raw.api_bosscomp === 0 ? false : undefined,
    bossCellNo: raw.api_bosscell_no ?? undefined,
    updatedAt: now,
    extras: raw,
  };
}