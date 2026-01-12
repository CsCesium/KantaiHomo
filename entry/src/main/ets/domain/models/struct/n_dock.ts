//src/main/ets/domain/models/nuykyo.ts
//by よよカービィ
// 进入入渠界面 调api_get_member/ndock
// 开始入渠修船 调api_req_nyukyo/start和api_get_member/ndock
// 在入渠界面倒计时结束时，自动调api_get_member/ndock

export interface Ndock {
  dockId: number;
  state: number;
  shipUid: number;
  completeTime: number;
  completeTimeStr?: string;
  cost: { fuel: number; steel: number };
  updatedAt: number;
}