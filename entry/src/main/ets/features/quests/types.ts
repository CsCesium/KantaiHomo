import type { QuestSnapshot } from '../state/type';

export interface QuestFleetShip {
  uid: number;
  masterId: number;
  name: string;
  stype: number;
  ctype: number;
  level: number;
  position: number;
  ancestors: number[];
  names: string[];
  nation?: string;
}

export interface QuestFormationRule {
  舰?: string[];
  舰型?: number[];
  国籍?: string[];
  位置?: number;
  等级?: number;
  大于等于?: number;
  小于等于?: number;
  等于?: number;
}
export interface QuestFormationDefinition { ID: number; 要求: QuestFormationRule[]; }

export type QuestShipConstraint = [number[], number, boolean?];
export interface QuestGoal {
  key: string;
  event: string;
  description?: string;
  required: number;
  init?: number;
  maparea?: number[];
  mapcell?: number[];
  flagshipId?: number[];
  secondshipId?: number[];
  flagshiptype?: number[];
  flagshipclass?: number[];
  secondshipclass?: number[];
  escortshipId?: QuestShipConstraint[];
  escortshipIdAll?: QuestShipConstraint[];
  escortshiptype?: QuestShipConstraint[];
  escortshipclass?: QuestShipConstraint[];
  banshiptype?: number[];
  fleetlimit?: number;
  shipType?: number[];
  mission?: string[];
  slotitemType2?: number[];
  slotitemId?: number[];
  materialShipType?: number[];
  materialShipMinCount?: number;
  times?: number[];
}
export interface QuestGoalDefinition { id: number; type: number; resetInterval: number; goals: QuestGoal[]; }
export interface QuestGoalFile { source: string; version: string; quests: QuestGoalDefinition[]; }

export interface QuestCountEvent {
  event: string;
  delta: number;
  fleet?: QuestFleetShip[];
  maparea?: number;
  mapcell?: number;
  shipType?: number;
  mission?: string;
  slotitemType2?: number;
  slotitemId?: number;
  materialShipTypes?: number[];
  times?: number;
}
export interface QuestCountRecord {
  quest: QuestSnapshot;
  counts: Record<string, number>;
  estimated: boolean;
  period: string;
  resetPeriod: string;
}
export interface QuestGoalProgress {
  key: string;
  description: string;
  label: string;
  /** The local count has reached this subgoal's target; not the server quest state. */
  satisfied: boolean;
}
export interface QuestProgressView {
  label: string;
  items: QuestGoalProgress[];
  anySatisfied: boolean;
  note: string;
}
