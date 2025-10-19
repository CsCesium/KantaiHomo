//src/main/ets/domain/models/nuykyo.ts
//by よよカービィ
// 进入入渠界面 调api_get_member/ndock
// 开始入渠修船 调api_req_nyukyo/start和api_get_member/ndock
// 在入渠界面倒计时结束时，自动调api_get_member/ndock

export interface ApiNdockRespRaw{
  api_member_id: number; // 提督ID
  api_id: number;        // 船渠id 1~4
  api_state: number;     // 船渠状态，-1锁定 0空置 1入渠
  api_ship_id: number;   // 入渠船入籍id
  api_complete_time: number; // 完成剩余时间纳秒
  api_complete_time_str: string; // 完成时间文本 2025-10-18 23:31:19
  api_item1: number;     // 消费资源：油
  api_item2: number;     // 消费资源：弹(固定0)
  api_item3: number;     // 消费资源：钢
  api_item4: number;     // 消费资源：铝(固定0)
}

export interface ApiNdock{
  dockId: number;         // 船渠id 1~4
  state: number;          // 船渠状态，-1锁定 0空置 1入渠
  shipId: number;         // 入渠船入籍id
  returnTime: number;     // 完成剩余时间纳秒
  updatedAt: number;
}

export function normalizeApiNdock(raw: ApiNdockRespRaw[]): ApiNdock[] {
  return raw.map((item) => ({
    dockId: item.api_id,
    state: item.api_state,
    shipId: item.api_ship_id,
    returnTime: item.api_complete_time,
    updatedAt: Date.now(),
  }));
}