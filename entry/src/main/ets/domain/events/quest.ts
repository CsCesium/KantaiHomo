import { QuestListPage } from "../models/struct/quest"
import { PayloadEvent } from "./type"

export type QuestListEvent = PayloadEvent<'QUEST_LIST', QuestListPage>

export interface QuestClaimedPayload {
  questId: number;
  claimedAt: number;
}

export type QuestClaimedEvent = PayloadEvent<'QUEST_CLAIMED', QuestClaimedPayload>

export interface QuestStateChangedPayload {
  questId: number;
  /** 1=未接取，2=已接取 */
  state: 1 | 2;
  changedAt: number;
}

export type QuestStateChangedEvent = PayloadEvent<'QUEST_STATE_CHANGED', QuestStateChangedPayload>

export type AnyQuestEvt = QuestListEvent | QuestClaimedEvent | QuestStateChangedEvent
