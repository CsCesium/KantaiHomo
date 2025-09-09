export type Channel =
  | "system"            // 心跳/服务端广播
    | "expedition"        // 远征相关
    | "battle"            // 战斗相关（含夜战提示）
    | "log";              // 调试日志

export interface BaseMsg<T = unknown> {
  ch: Channel;          // 通道
  type: string;         // 事件类型
  ts?: number;          // 服务器时间戳(毫秒)
  payload: T;           // 负载
}

export interface ExpeditionReady {
  fleetId: number;             // 1/2/3/4
  expeditionId: number;        // 远征编号
  remainMs: number;            // 剩余毫秒（=0 或 <0 表示已完成）
}

export interface YasenPrompt {
  nodeId?: string;             // 可选：战斗节点
  yesTex: string;              // 'battle_main_49'
  noTex: string;               // 'battle_main_9'
  container?: string;          // 你探测到的容器id
}

export type AnyMsg =
  | BaseMsg<ExpeditionReady>
    | BaseMsg<YasenPrompt>
    | BaseMsg<unknown>;