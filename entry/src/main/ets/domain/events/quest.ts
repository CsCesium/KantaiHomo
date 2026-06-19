import { QuestListPage } from "../models/struct/quest"
import { PayloadEvent } from "./type"

export type QuestListEvent = PayloadEvent<'QUEST_LIST', QuestListPage>

export interface QuestClaimedPayload {
  questId: number;
  claimedAt: number;
}

export type QuestClaimedEvent = PayloadEvent<'QUEST_CLAIMED', QuestClaimedPayload>

export type AnyQuestEvt = QuestListEvent | QuestClaimedEvent
