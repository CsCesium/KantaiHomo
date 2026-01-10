import type { ApiPortDataRaw } from '../models/api/port';
import type { PortSnapshot, AdmiralState, ResourceState, FleetPortState } from '../models/port';
import { normalizeShip } from './ship';
import { normalizeNdockList } from './nyukyo';

function normalizeAdmiral(raw: ApiPortDataRaw['api_basic']): AdmiralState {
  return {
    id: raw.api_member_id,
    name: raw.api_nickname,
    level: raw.api_level,
    experience: raw.api_experience,
    maxShips: raw.api_max_chara,
    maxItems: raw.api_max_slotitem,
    largeDockEnabled: (raw.api_large_dock ?? 0) > 0,
  };
}

function normalizeResources(raw: ApiPortDataRaw['api_material']): ResourceState {
  const byId: Record<number, number> = {};
  for (const m of raw ?? []) byId[m.api_id] = m.api_value;
  return { byId };
}

function normalizeFleets(raw: ApiPortDataRaw['api_deck_port'], now: number): FleetPortState[] {
  return (raw ?? []).map((d) => {
    const [state, missionId, returnTimeMs, reserved] = d.api_mission ?? [0, 0, 0, 0];
    return {
      deckId: d.api_id,
      name: d.api_name,
      shipIds: (d.api_ship ?? []).filter((x) => x > 0),
      mission: { state, missionId, returnTimeMs, reserved },
      updatedAt: now,
    };
  });
}

export function normalizePortSnapshot(raw: ApiPortDataRaw, now: number = Date.now()): PortSnapshot {
  const ships: Record<number, any> = {};
  for (const s of raw.api_ship ?? []) {
    const ship = normalizeShip(s, now);
    ships[ship.uid] = ship;
  }

  return {
    admiral: normalizeAdmiral(raw.api_basic),
    resources: normalizeResources(raw.api_material),
    fleets: normalizeFleets(raw.api_deck_port, now),
    ndocks: normalizeNdockList(raw.api_ndock ?? [], now),

    ships,

    combinedFlag: raw.api_combined_flag,
    portBgmId: raw.api_p_bgm_id,

    updatedAt: now,
  };
}