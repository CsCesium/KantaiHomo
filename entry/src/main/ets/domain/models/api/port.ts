export type NumPair = readonly [number, number]
export type Num3 = readonly [number, number, number]
export type status = readonly [number, number, number, number, number, number, number]

/** api_port/port 的 api_data */
export interface ApiPortData {
  api_material: ApiMaterialItem[]
  api_deck_port: ApiDeckPort[]
  api_ndock: ApiNdockDock[]
  api_ship: ApiShip
  api_basic: ApiBasic

  api_log?: ApiLogEntry[]

  api_combined_flag?: number
  api_p_bgm_id?: number

  /** 活动期间结构：先用 unknown/Record，后续再逐步细化 */
  api_event_object?: unknown

  api_parallel_quest_count?: number
  api_dest_ship_slot?: number

  api_plane_info?: ApiPlaneInfo
}

/** 资源信息（api_get_member/material 同结构） */
export interface ApiMaterialItem {
  api_id: number
  api_value: number
}

/** 舰队信息（你也可以直接复用 domain/models/deck.ts 的 Raw 结构） */
export interface ApiDeckPort {
  api_id: number
  api_name: string
  api_name_id?: string
  api_mission: Num3 // [远征状态?, 结束时间?, 任务id?]（具体语义你可后续在 domain 层规范）
  api_flagship: string
  api_ship: number[] // ship instance api_id 列表，-1 表示空位
}

/** 入渠（ndock） */
export interface ApiNdockDock {
  api_id: number
  api_state: number
  api_ship_id: number
  api_complete_time: number // ms epoch
  api_complete_time_str: string
  api_item1: number
  api_item2: number
}

/** 舰船信息数组 */
export type ApiShip = ApiShipItem[]

export interface ApiShipItem {
  api_id: number            // 舰船固有ID（实例ID）
  api_sortno?: number
  api_ship_id: number       // 舰娘ID（mst id）
  api_lv: number
  api_exp: Num3             // [累计, 距下一级, 百分比?]
  api_nowhp: number
  api_maxhp: number
  api_soku: number          // 0/5/10/15/20
  api_leng: number          // 0..(4/5)
  api_slot: number[]        // 装备实例ID，-1空
  api_onslot: number[]      // 搭载数
  api_slot_ex: number       // 0未解放, -1未装备, >0 装备实例ID

  api_kyouka: status          // [火雷对装运耐对潜]
  api_backs?: number

  api_fuel: number
  api_bull: number
  api_slotnum: number

  api_ndock_time: number
  api_ndock_item: NumPair      // [油,钢]

  api_srate?: number
  api_cond: number

  api_karyoku: NumPair
  api_raisou: NumPair
  api_taiku: NumPair
  api_soukou: NumPair
  api_kaihi: NumPair
  api_taisen: NumPair
  api_sakuteki: NumPair
  api_lucky: NumPair

  api_locked: number
  api_locked_equip?: number

  /** 活动时才有 */
  api_sally_area?: number
}

/** basic（api_get_member/basic 同结构 + 额外字段） */
export interface ApiBasic {
  api_member_id: number
  api_nickname: string
  api_level: number
  api_experience: number

  api_max_chara: number
  api_max_slotitem: number

  /** 额外 */
  api_large_dock?: number
}

/** 母港通知栏 */
export interface ApiLogEntry {
  api_no: number
  api_type: string
  api_state: string
  api_message: string
}

/** 基地航空队相关 */
export interface ApiPlaneInfo {
  api_unset_slot?: ApiUnsetSlot[]
  api_base_convert_slot?: number[] // 装备固有ID 列表
}

export interface ApiUnsetSlot {
  api_type3No: number
  api_slot_list: number[]
}