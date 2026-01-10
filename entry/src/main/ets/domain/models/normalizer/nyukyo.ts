import type { ApiNdockRespRaw } from '../models/api/nyukyo';
import type { NdockSlotState } from '../models/nyukyo';

export function normalizeNdockList(raw: ApiNdockRespRaw[], now: number = Date.now()): NdockSlotState[] {
  return (raw ?? []).map((item) => ({
    dockId: item.api_id,
    state: item.api_state,
    shipId: item.api_ship_id,
    completeTime: item.api_complete_time,
    cost: { fuel: item.api_item1 ?? 0, steel: item.api_item3 ?? 0 },
    updatedAt: now,
  }));
}