//by よよカービィ
// 进入入渠界面 调api_get_member/ndock
// 开始入渠修船 调api_req_nyukyo/start和api_get_member/ndock
// 在入渠界面倒计时结束时，自动调api_get_member/ndock

export interface ApiNdockRespRaw {
  api_member_id: number;
  api_id: number;              // dock id
  api_state: number;           // -1锁定 0空置 1入渠
  api_ship_id: number;         // 舰船实例id
  api_complete_time: number;   // 注意：很多资料是 epoch(ms)，你先按 number 收
  api_complete_time_str: string;

  api_item1: number; // 油
  api_item2: number; // 弹（通常0）
  api_item3: number; // 钢
  api_item4: number; // 铝（通常0）
}