//src/main/ets/domain/events/type.ts
export type EventType =
    | 'PORT'            //回港
    | 'EXPEDITION'      //远征
    | 'QUEST'           //任务
    | 'BATTLE_START'    //战斗开始
    | 'BATTLE_RESULT'   //战斗结束
    | 'DOCK_REPAIR'     //维修
    | 'GET_MEMBER';     //待拓展

export interface EventBase {
  id: string;                          // 去重用
  timestamp: number;                   // 时间戳
  source: 'web' | 'vpn' | 'companion'; // 来源
  schemaVersion?: number;              // reserved for future
  endpoint?: string;                   // /kcsapi/...
}

export interface PayloadEvent<TType extends string, TPayload> extends EventBase {
  type: TType
  payload: TPayload
}

