import type { Admiral } from "../models/struct/admiral"
import type { Kdock } from "../models/struct/k_dock"
import type { UseItemStack } from "../models/struct/useitem"
import { PayloadEvent } from "./type"

export interface RequireInfoUpdatePayload {
  admiral: Admiral
  kdocks: Kdock[]
  useItems: UseItemStack[]
}

export type RequireInfoUpdateEvent = PayloadEvent<'REQUIRE_INFO_UPDATE', RequireInfoUpdatePayload>

export type AnyRequireInfoEvt = RequireInfoUpdateEvent
