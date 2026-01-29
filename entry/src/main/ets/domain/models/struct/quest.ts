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
  quests: Quest[];
  updatedAt: number;
}