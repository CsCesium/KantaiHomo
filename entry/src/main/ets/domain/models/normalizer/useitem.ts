import { ApiUseItemRaw } from "../api/useitem";
import { UseItemStack } from "../struct/useitem";

export function normalizeUseItem(raw: ApiUseItemRaw, now: number = Date.now()): UseItemStack {
  return {
    itemId: raw.api_id,
    count: raw.api_count ?? 0,
    updatedAt: now,
    extras: raw,
  };
}

export function normalizeUseItems(raw: ApiUseItemRaw[] | undefined, now: number = Date.now()): UseItemStack[] {
  return (raw ?? []).map((x) => normalizeUseItem(x, now));
}