import { QuestState } from "../enums/quest";

export interface QuestSelectableReward {
  no: number;
  kind: number;
  mstId: number;
  count: number;
}

export interface Quest {
  questId: number;
  category: number;
  type: number;
  state: QuestState;
  title: string;
  detail: string;
  progress?: number;
  bonusFlag?: number;
  materials?: number[];
  selectRewards?: QuestSelectableReward[];
  updatedAt: number;
  extras?: Record<string, unknown>;
}

export interface QuestListPage {
  count: number;
  completedKind: number;
  pageCount: number;
  page: number;
  /** 请求参数 api_tab_id；0 表示“全部”标签，仅完整遍历所有分页后可清理缺失任务。 */
  tabId?: number;
  quests: Quest[];
  updatedAt: number;
}
