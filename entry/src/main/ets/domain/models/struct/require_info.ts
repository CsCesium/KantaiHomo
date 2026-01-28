import { Admiral, SlotItem, UnsetSlot, Kdock, UseItemStack } from ".";


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
