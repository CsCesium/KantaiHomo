import { ApiBasicRaw } from "../api/basic";
import { Admiral } from "../struct/admiral";

export function normalizeAdmiral(raw: ApiBasicRaw, now: number = Date.now()): Admiral {
  return {
    memberId: raw.api_member_id,
    nickname: raw.api_nickname ?? '',
    level: raw.api_level ?? 0,
    experience: raw.api_experience ?? 0,
    maxShips: raw.api_max_chara ?? 0,
    maxSlotItems: raw.api_max_slotitem ?? 0,
    rank: raw.api_rank ?? undefined,
    largeDockEnabled: raw.api_large_dock === 1 ? true : raw.api_large_dock === 0 ? false : undefined,
    updatedAt: now,
    extras: raw,
  };
}