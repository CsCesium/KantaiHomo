import type { Ship } from './ship';
import type { NdockSlotState } from './nyukyo';

export interface AdmiralState {
  id: number;
  name: string;
  level: number;
  experience: number;
  maxShips: number;
  maxItems: number;
  largeDockEnabled: boolean;
}

export interface ResourceState {
  byId: Record<number, number>; // api_id -> value
}

export interface FleetPortState {
  deckId: number;
  name: string;
  shipIds: number[]; // 过滤掉 -1
  mission: {
    state: number;
    missionId: number;
    returnTimeMs: number;
    reserved: number;
  };
  updatedAt: number;
}

export interface PortSnapshot {
  admiral: AdmiralState;
  resources: ResourceState;
  fleets: FleetPortState[];
  ndocks: NdockSlotState[];

  ships: Record<number, Ship>; // uid -> Ship

  combinedFlag?: number;
  portBgmId?: number;

  updatedAt: number;
}