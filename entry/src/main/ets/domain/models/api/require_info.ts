import { ApiBasicRaw } from "./basic";
import { ApiKdockRaw } from "./k_dock";
import { ApiSlotItemRaw, ApiUnsetSlotRaw } from "./slotitem";
import { ApiUseItemRaw } from "./useitem";

export interface ApiRequireInfoRespRaw {
  api_basic: ApiBasicRaw;
  api_slot_item: ApiSlotItemRaw[];
  api_unsetslot: ApiUnsetSlotRaw;
  api_kdock: ApiKdockRaw[];
  api_useitem?: ApiUseItemRaw[];

  api_skin_id?: number;
  api_extra_supply?: number[];

  [k: string]: unknown;
}