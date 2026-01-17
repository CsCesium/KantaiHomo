import { Admiral, Deck, Kdock, Materials, Ndock, PortSnapshot, Ship, SlotItem } from "../models/struct"
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
