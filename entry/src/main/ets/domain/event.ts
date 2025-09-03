export type EventType =  'PORT'
  | 'EXPEDITION'
  | 'QUEST'
  |'BATTLE_RESULT'
  |'BATTLE_START'
  |'DOCK_REPAIR'
  |'GET_MEMBER';

export interface GameEvent<T=any>{
  id:string,     // avoid duplication
  type:EventType,
  payload:T,
  timestamp: number,
  source: 'web'| 'vpn' |'companion',
  raw?: string, // raw JSON
}