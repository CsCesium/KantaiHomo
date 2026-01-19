import { Admiral } from "../models/struct/admiral"
import { Deck } from "../models/struct/deck"
import { Kdock } from "../models/struct/k_dock"
import { Materials } from "../models/struct/material"
import { Ndock } from "../models/struct/n_dock"
import { PortSnapshot } from "../models/struct/port"
import { Ship } from "../models/struct/ship"
import { SlotItem } from "../models/struct/slotitem"
import { PayloadEvent } from "./type"


export type PortSnapshotEvent = PayloadEvent<'PORT_SNAPSHOT',PortSnapshot>
export type PortBasicEvent = PayloadEvent<'PORT_BASIC',Admiral>
export type PortResourcesEvent = PayloadEvent<'PORT_RESOURCES', Materials>
export type PortFleetsEvent = PayloadEvent<'PORT_FLEETS', Deck[]>
export type PortNdockEvent = PayloadEvent<'PORT_NDOCK', Ndock[]>
export type PortKdockEvent = PayloadEvent<'PORT_KDOCK', Kdock[]>
export type PortShipsEvent = PayloadEvent<'PORT_SHIPS', Ship[]>
export type PortSlotItemsEvent = PayloadEvent<'PORT_SLOTITEMS', SlotItem[]>


export type AnyPortEvt =
  | PortSnapshotEvent
    | PortBasicEvent
    | PortResourcesEvent
    | PortFleetsEvent
    | PortNdockEvent
    | PortKdockEvent
    | PortShipsEvent
    | PortSlotItemsEvent
