import { ApiRequireInfoRespRaw } from "../api/require_info";
import { RequireInfoSnapshot } from "../struct/require_info";
import { normalizeUseItems } from "../struct/useitem";
import { normalizeAdmiral } from "./admiral";
import { normalizeKdocks } from "./k_dock";
import { normalizeSlotItems, normalizeUnsetSlot } from "./slotitem";

export function normalizeRequireInfo(raw: ApiRequireInfoRespRaw, now: number = Date.now()): RequireInfoSnapshot {
  return {
    admiral: normalizeAdmiral(raw.api_basic, now),
    slotItems: normalizeSlotItems(raw.api_slot_item, now),
    unsetSlot: normalizeUnsetSlot(raw.api_unsetslot, now),
    kdocks: normalizeKdocks(raw.api_kdock, now),
    useItems: normalizeUseItems(raw.api_useitem, now),
    skinId: raw.api_skin_id ?? undefined,
    extraSupply: raw.api_extra_supply ?? undefined,
    updatedAt: now,
    extras: raw,
  };
}