/**
 * LBAS - 基地航空队 (Land Base Air Squadron)
 * 内存中维护的当前状态；不持久化。
 */

export interface LbasSquadron {
  squadronId: number;
  state: number;    // 0=未配置, 1=配置中, 2=疲劳
  slotId: number;   // 装备实例 UID（0 表示未配置）
  count: number;    // 当前搭载数
  maxCount: number; // 最大搭载数
  cond: number;     // 1=正常, 2=橙疲, 3=红疲
}

export interface LbasBase {
  baseId: number;
  areaId: number;
  name: string;
  distanceBase: number;
  distanceBonus: number;
  actionKind: number;  // 0=待机, 1=出撃, 2=防空, 3=退避, 4=休息
  squadrons: LbasSquadron[];
}
