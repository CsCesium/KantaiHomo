import type { ApiShipItem, ApiBasic, ApiDeckPort, ApiMaterialItem, ApiNdockDock } from './api/port'
export interface AdmiralState {
  id: number
  name: string
  level: number
  experience: number
  maxShips: number
  maxItems: number
  largeDockEnabled: boolean
}
export interface ResourceState {
  byId: Record<number, number> // api_id -> api_value
}

export interface FleetState {
  id: number
  name: string
  shipIds: number[] // ship instance id，去掉 -1
  mission?: {
    raw: readonly [number, number, number]
  }
}
export interface RepairDockState {
  id: number
  state: number
  shipId: number
  completeTime: number
}
export interface UserShipState {
  id: number           // instance id
  shipId: number       // mst id
  level: number
  nowHp: number
  maxHp: number
  cond: number
  speed: number
  range: number
  slots: Array<number | null>      // 装备实例ID（null表示空）
  slotEx: number | null
  onslot: number[]
  fuel: number
  bull: number
  sallyArea?: number
}
export interface PortSnapshot {
  admiral: AdmiralState
  resources: ResourceState
  fleets: FleetState[]
  repairs: RepairDockState[]
  ships: Record<number, UserShipState> // instance id -> ship
}

/** ---- converters ---- */
export function toAdmiralState(b: ApiBasic): AdmiralState {
  return {
    id: b.api_member_id,
    name: b.api_nickname,
    level: b.api_level,
    experience: b.api_experience,
    maxShips: b.api_max_chara,
    maxItems: b.api_max_slotitem,
    largeDockEnabled: (b.api_large_dock ?? 0) > 0,
  }
}

export function toResourceState(mats: ApiMaterialItem[]): ResourceState {
  const byId: Record<number, number> = {}
  for (const m of mats) byId[m.api_id] = m.api_value
  return { byId }
}

export function toFleetState(d: ApiDeckPort): FleetState {
  return {
    id: d.api_id,
    name: d.api_name,
    shipIds: (d.api_ship ?? []).filter((x) => x > 0),
    mission: d.api_mission ? { raw: d.api_mission } : undefined,
  }
}

export function toRepairDockState(n: ApiNdockDock): RepairDockState {
  return {
    id: n.api_id,
    state: n.api_state,
    shipId: n.api_ship_id,
    completeTime: n.api_complete_time,
  }
}
export function toUserShipState(s: ApiShipItem): UserShipState {
  return {
    id: s.api_id,
    shipId: s.api_ship_id,
    level: s.api_lv,
    nowHp: s.api_nowhp,
    maxHp: s.api_maxhp,
    cond: s.api_cond,
    speed: s.api_soku,
    range: s.api_leng,
    slots: (s.api_slot ?? []).map((x) => (x > 0 ? x : null)),
    slotEx: s.api_slot_ex > 0 ? s.api_slot_ex : null,
    onslot: s.api_onslot ?? [],
    fuel: s.api_fuel,
    bull: s.api_bull,
    sallyArea: s.api_sally_area,
  }
}