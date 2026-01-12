import { UseItemStack } from "../normalizer/useitem";
import { Admiral } from "./admiral";
import { Kdock } from "./k_dock";
import { SlotItem, UnsetSlot } from "./slotItem";

export interface RequireInfoSnapshot {
  admiral: Admiral;
  slotItems: SlotItem[];
  unsetSlot: UnsetSlot;
  kdocks: Kdock[];
  useItems: UseItemStack[];
  skinId?: number;
  extraSupply?: number[];
  updatedAt: number;
  extras?: Record<string, unknown>;
}
