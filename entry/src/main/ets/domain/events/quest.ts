import { QuestListPage } from "../models/struct/quest"
import { PayloadEvent } from "./type"

export type QuestListEvent = PayloadEvent<'QUEST_LIST', QuestListPage>

export type AnyQuestEvt = QuestListEvent
