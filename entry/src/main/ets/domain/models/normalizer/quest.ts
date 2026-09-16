import { ApiQuestListItemRaw, ApiQuestListRespRaw } from "../api/quest";
import { questLabelTypeFromAppearanceType, QuestState } from "../enums/quest";
import { Quest, QuestListPage } from "../struct/quest";

/** Task API text uses HTML line breaks; native Text/Dialog expects newline characters. */
export function normalizeQuestText(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n');
}

export function normalizeQuest(raw: ApiQuestListItemRaw, now: number = Date.now()): Quest {
  const state =
    raw.api_state === 2 ? QuestState.ACTIVE :
      raw.api_state === 3 ? QuestState.COMPLETE : QuestState.LOCKED;

  return {
    questId: raw.api_no,
    category: raw.api_category,
    type: raw.api_label_type ?? questLabelTypeFromAppearanceType(raw.api_type),
    state,
    title: normalizeQuestText(raw.api_title ?? ''),
    detail: normalizeQuestText(raw.api_detail ?? ''),
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

export function normalizeQuestListPage(raw: ApiQuestListRespRaw, now: number = Date.now(), tabId?: number): QuestListPage {
  const quests: Quest[] = [];
  for (const item of raw.api_list ?? []) {
    if (item === null || item === -1) continue;
    quests.push(normalizeQuest(item, now));
  }

  return {
    count: raw.api_count ?? quests.length,
    activeCount: typeof raw.api_exec_count === 'number' && Number.isInteger(raw.api_exec_count) &&
      raw.api_exec_count >= 0 ? raw.api_exec_count : undefined,
    isComplete: raw.api_page_count === undefined && raw.api_disp_page === undefined,
    completedKind: raw.api_completed_kind ?? 0,
    pageCount: raw.api_page_count ?? 0,
    page: raw.api_disp_page ?? 1,
    tabId,
    quests,
    updatedAt: now,
  };
}
