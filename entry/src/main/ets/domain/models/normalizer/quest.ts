import { ApiQuestListItemRaw, ApiQuestListRespRaw } from "../api/quest";
import { Quest, QuestListPage } from "../struct/quest";

export function normalizeQuest(raw: ApiQuestListItemRaw, now: number = Date.now()): Quest {
  const state =
    raw.api_state === 2 ? 'active' :
      raw.api_state === 3 ? 'complete' : 'inactive';

  return {
    questId: raw.api_no,
    category: raw.api_category,
    type: raw.api_type,
    state,
    title: raw.api_title ?? '',
    detail: raw.api_detail ?? '',
    progress: raw.api_progress_flag ?? undefined,
    bonusFlag: raw.api_bonus_flag ?? undefined,
    materials: raw.api_get_material ?? undefined,
    selectRewards: raw.api_select_rewards?.map(r => ({
      no: r.api_no, kind: r.api_kind, mstId: r.api_mst_id, count: r.api_count,
    })),
    updatedAt: now,
    extras: raw,
  };
}

export function normalizeQuestListPage(raw: ApiQuestListRespRaw, now: number = Date.now()): QuestListPage {
  return {
    count: raw.api_count ?? 0,
    completedKind: raw.api_completed_kind ?? 0,
    pageCount: raw.api_page_count ?? 0,
    page: raw.api_disp_page ?? 1,
    quests: (raw.api_list ?? []).map((q) => normalizeQuest(q, now)),
    updatedAt: now,
  };
}