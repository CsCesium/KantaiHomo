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
  /** 服务端已接取总数，包含达成但尚未领取的任务；缺失时不可当成 0。 */
  activeCount?: number;
  /** 新版接口直接返回整个标签列表，分页由游戏客户端处理。 */
  isComplete?: boolean;
  completedKind: number;
  pageCount: number;
  page: number;
  /** 请求参数 api_tab_id；0 为全部，9 为已接取。 */
  tabId?: number;
  quests: Quest[];
  updatedAt: number;
}
