import { normalizeShip, PortLog, PortSnapshot } from "..";
import { ApiPortLogRaw, ApiPortRespRaw } from "../api/port";
import { normalizeAdmiral } from "./admiral";
import { normalizeDecks } from "./deck";
import { normalizeMaterials } from "./material";
import { normalizeNdocks } from "./n_dock";


export function normalizePortLog(raw: ApiPortLogRaw, now: number = Date.now()): PortLog {
  return {
    no: raw.api_no,
    type: raw.api_type ?? '',
    message: raw.api_message ?? '',
    updatedAt: now,
    extras: raw,
  };
}

export function normalizePort(raw: ApiPortRespRaw, now: number = Date.now()): PortSnapshot {
  return {
    admiral: normalizeAdmiral(raw.api_basic, now),
    materials: normalizeMaterials(raw.api_material, now),
    decks: normalizeDecks(raw.api_deck_port, now),
    ndocks: normalizeNdocks(raw.api_ndock, now),
    ships: (raw.api_ship ?? []).map((s) => normalizeShip(s, now)),
    logs: (raw.api_log ?? []).map((l) => normalizePortLog(l, now)),

    combinedFlag: raw.api_combined_flag ?? undefined,
    bgmId: raw.api_p_bgm_id ?? undefined,
    parallelQuestCount: raw.api_parallel_quest_count ?? undefined,

    updatedAt: now,
    extras: raw,
  };
}