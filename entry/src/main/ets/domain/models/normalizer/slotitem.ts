import { ApiSlotItemRaw, ApiUnsetSlotRaw } from "../api/slotitem";
import { SlotItem, UnsetSlot } from "../struct/slotitem";

export function normalizeSlotItem(raw: ApiSlotItemRaw, now: number = Date.now()): SlotItem {
  return {
    uid: raw.api_id,
    masterId: raw.api_slotitem_id,
    locked: raw.api_locked === 1,
    level: raw.api_level ?? undefined,
    alv: raw.api_alv ?? undefined,
    updatedAt: now,
    extras: raw,
  };
}

export function normalizeSlotItems(raw: ApiSlotItemRaw[], now: number = Date.now()): SlotItem[] {
  return (raw ?? []).map((x) => normalizeSlotItem(x, now));
}

export function normalizeUnsetSlot(raw: ApiUnsetSlotRaw, now: number = Date.now()): UnsetSlot {
  const byType3No: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const n = Number(k);
    if (!Number.isNaN(n)) byType3No[n] = Array.isArray(v) ? v : [];
  }
  return { byType3No, updatedAt: now };
}