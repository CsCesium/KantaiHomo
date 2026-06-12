// src/main/ets/domain/events/kousyou.ts
// 工厂（開発/建造/改修）结果事件

import { PayloadEvent } from './type';

/** 单个开发产出条目 */
export interface DevItemEntry {
  /** 装备实例 UID（失败时为 0） */
  uid: number;
  /** 装备图鉴 ID（失败时为 -1） */
  masterId: number;
  /** 该槽是否开发成功 */
  success: boolean;
}

/** 装备开发结果（/api_req_kousyou/createitem） */
export interface DevItemResultPayload {
  items: DevItemEntry[];
}

/** 建造完成领取舰娘（/api_req_kousyou/getship） */
export interface GetShipResultPayload {
  /** 建造渠 ID（无法解析时为 0） */
  kdockId: number;
  /** 新舰娘实例 UID（无法解析时为 0） */
  shipUid: number;
  /** 舰娘图鉴 ID */
  shipMasterId: number;
}

/** 改修结果（/api_req_kousyou/remodel_slot） */
export interface RemodelSlotResultPayload {
  success: boolean;
  /** 改修前装备图鉴 ID */
  beforeMasterId: number;
  /** 改修后装备图鉴 ID（更新改修时与 before 不同） */
  afterMasterId: number;
  /** 改修后的 ★ 等级（仅成功时有效，未知为 -1） */
  afterLevel: number;
}

/**
 * 建造开始（/api_req_kousyou/createship）。
 * 响应不含舰娘信息，舰娘图鉴 ID 由紧随其后的 kdock 更新补全。
 */
export interface CreateShipStartPayload {
  kdockId: number;
  /** 是否大型建造 */
  isLarge: boolean;
  /** 是否使用高速建造材 */
  highspeed: boolean;
}

/** 单个建造渠状态（/api_get_member/kdock） */
export interface KdockEntry {
  dockId: number;
  /** 0=空闲 1=未解锁? 2=建造中 3=建造完成 */
  state: number;
  /** 建造中舰娘图鉴 ID（空渠为 0） */
  shipMasterId: number;
  completeTime: number;
}

/** 建造渠列表更新 */
export interface KdockUpdatePayload {
  docks: KdockEntry[];
}

export type DevItemResultEvent = PayloadEvent<'KOUSYOU_DEV_RESULT', DevItemResultPayload>;
export type GetShipResultEvent = PayloadEvent<'KOUSYOU_GETSHIP_RESULT', GetShipResultPayload>;
export type RemodelSlotResultEvent = PayloadEvent<'KOUSYOU_REMODEL_RESULT', RemodelSlotResultPayload>;
export type CreateShipStartEvent = PayloadEvent<'KOUSYOU_CREATESHIP_START', CreateShipStartPayload>;
export type KdockUpdateEvent = PayloadEvent<'KOUSYOU_KDOCK_UPDATE', KdockUpdatePayload>;

export type AnyKousyouEvt =
  | DevItemResultEvent
  | GetShipResultEvent
  | RemodelSlotResultEvent
  | CreateShipStartEvent
  | KdockUpdateEvent;
