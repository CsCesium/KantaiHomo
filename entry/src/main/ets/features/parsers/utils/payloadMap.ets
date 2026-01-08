//src/main/ets/features/parsers/utils/payloadMap.ets
import { ExpeditionEventPayload } from "../../router/persist/type";

export interface PersistPayloadByType {
  EXPEDITION: ExpeditionEventPayload

  // TODO:
  // BATTLE_RESULT: BattleResultPayload
  // DOCK_REPAIR: DockRepairPayload
  // QUEST: QuestPayload
  // ...
}