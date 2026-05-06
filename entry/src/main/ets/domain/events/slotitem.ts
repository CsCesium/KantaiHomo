import type { SlotItem } from "../models/struct/slotitem"
import { PayloadEvent } from "./type"

export type SlotItemsUpdateEvent = PayloadEvent<'SLOTITEMS_UPDATE', SlotItem[]>

export type AnySlotItemEvt = SlotItemsUpdateEvent
