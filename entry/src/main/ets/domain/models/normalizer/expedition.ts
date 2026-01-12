import { ApiDeckMissionTuple,
  ApiMissionCatalogRaw,
  ApiMissionResultRespRaw, ApiMissionStartRespRaw } from '../api/mission';
import {
  ExpeditionProgress,
  type ExpeditionSlotState,
  type MissionCatalogItem,
  type MissionResult,
  type MissionStart,
} from '../struct/expedition';

function toProgress(state: number): ExpeditionProgress {
  switch (state) {
    case 0: return ExpeditionProgress.IDLE;
    case 1: return ExpeditionProgress.RUNNING;
    case 2: return ExpeditionProgress.RETURNABLE;
    case 3: return ExpeditionProgress.FORCED_RETURN;
    default:
      return state > 0 ? ExpeditionProgress.RUNNING : ExpeditionProgress.IDLE;
  }
}

export function normalizeMissionStart(
  deckId: number,
  missionId: number,
  raw: ApiMissionStartRespRaw,
  now: number = Date.now(),
): MissionStart {
  return {
    deckId,
    missionId,
    complTime: raw.api_complatetime,
    complTimeStr: raw.api_complatetime_str,
    updatedAt: now,
  };
}

export function normalizeDeckMission(
  deckId: number,
  tuple: ApiDeckMissionTuple,
  now: number = Date.now(),
): ExpeditionSlotState {
  const [state, missionId, returnMs, _reserved] = tuple;

  const progress = toProgress(state);
  return {
    deckId,
    progress,
    missionId: progress === ExpeditionProgress.IDLE ? 0 : missionId,
    returnTime: progress === ExpeditionProgress.IDLE ? 0 : returnMs,
    updatedAt: now,
  };
}

export function normalizeMissionResult(
  deckId: number,
  missionId: number,
  raw: ApiMissionResultRespRaw,
  now: number = Date.now(),
): MissionResult {
  const items: Array<{ id: number; name?: string; count: number }> = [];

  if (raw.api_useitem_flag?.[0] && raw.api_get_item1) {
    items.push({
      id: raw.api_get_item1.api_useitem_id,
      name: raw.api_get_item1.api_useitem_name ?? undefined,
      count: raw.api_get_item1.api_useitem_count,
    });
  }
  if (raw.api_useitem_flag?.[1] && raw.api_get_item2) {
    items.push({
      id: raw.api_get_item2.api_useitem_id,
      name: raw.api_get_item2.api_useitem_name ?? undefined,
      count: raw.api_get_item2.api_useitem_count,
    });
  }

  const mat = raw.api_get_material;
  const materials =
    mat && mat.length >= 4 && mat[0] !== -1
      ? ([mat[0], mat[1], mat[2], mat[3]] as [number, number, number, number])
      : undefined;

  return {
    deckId,
    missionId,
    clear: raw.api_clear_result,
    admiral: { lv: raw.api_member_lv, exp: raw.api_member_exp, getExp: raw.api_get_exp },

    shipIds: raw.api_ship_id ?? [],
    shipExp: raw.api_get_ship_exp ?? [],
    shipExpLvup: raw.api_get_exp_lvup ?? [],

    drops: {
      materials,
      items: items.length ? items : undefined,
    },

    quest: {
      name: raw.api_quest_name,
      level: raw.api_quest_level,
      detail: raw.api_detail,
      areaName: raw.api_maparea_name,
    },

    finishedAt: now,
  };
}

export function normalizeMissionCatalog(
  raw: ApiMissionCatalogRaw,
  now: number = Date.now(),
): MissionCatalogItem {
  const item = (arr?: [number, number]) => (arr ? { itemId: arr[0], count: arr[1] } : undefined);

  return {
    id: raw.api_id,
    code: raw.api_disp_no,
    mapAreaId: raw.api_maparea_id,

    name: raw.api_name,
    details: raw.api_details,

    resetType: raw.api_reset_type === 1 ? 'monthly' : 'normal',
    damageType: raw.api_damage_type,

    timeMin: raw.api_time,
    requireShips: raw.api_deck_num,
    difficulty: raw.api_difficulty,

    costRatio: { fuelPct: raw.api_use_fuel, ammoPct: raw.api_use_bull },

    reward: {
      winItem1: item(raw.api_win_item1),
      winItem2: item(raw.api_win_item2),
      matLevel: raw.api_win_mat_level,
    },

    returnCancelable: raw.api_return_flag === 1,
    sampleFleet: raw.api_sample_fleet,

    updatedAt: now,
  };
}