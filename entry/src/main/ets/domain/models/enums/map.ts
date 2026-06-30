/**
 * Map Event 类型枚举和描述
 *
 * 来自 api_event_id 和 api_event_kind
 */
// ========== Event ID (api_event_id) ==========
export const MapEventId = {
  /** 起点 */
  NONE: 0,
  /** 无事件 */
  NOTHING: 1,
  /** 资源获取 */
  RESOURCE: 2,
  /** 漩涡 (资源损失) */
  MAELSTROM: 3,
  /** 战斗 */
  BATTLE: 4,
  /** Boss 战斗 */
  BOSS: 5,
  /** 无战斗；eventKind=2 时为旧式能动分歧 */
  AVOID: 6,
  /** 航空战或航空侦察 */
  AIR_BATTLE: 7,
  /** 护卫成功 */
  ESCORT_SUCCESS: 8,
  /** 输送物资 */
  TRANSPORT: 9,
  /** 空袭战 */
  AIR_RAID: 10,
  /** 长距离空袭战 */
  LONG_AIR_RAID: 11,
  /** 雷达射击 */
  NIGHT_RAID: 12,
  /** 泊地修理 */
  ANCHORAGE: 13,
  /** 能动分歧 */
  SELECTOR: 14,
} as const;

export type MapEventIdType = typeof MapEventId[keyof typeof MapEventId];

// ========== Event Kind (api_event_kind) ==========
export const MapEventKind = {
  /** 无 */
  NONE: 0,
  /** 昼战 */
  DAY_BATTLE: 1,
  /** 夜战 */
  NIGHT_BATTLE: 2,
  /** 夜战→昼战 */
  NIGHT_TO_DAY: 3,
  /** 航空战 */
  AIR_BATTLE: 4,
  /** 敌联合舰队战 */
  COMBINED: 5,
  /** 长距离空袭战 */
  LONG_AIR_RAID: 6,
} as const;

export type MapEventKindType = typeof MapEventKind[keyof typeof MapEventKind];
// ========== 事件描述 ==========

/**
 * 获取事件 ID 的描述
 */
export function getEventIdDesc(eventId: number): string {
  switch (eventId) {
    case MapEventId.NONE: return '起点';
    case MapEventId.NOTHING: return '无事件';
    case MapEventId.RESOURCE: return '资源';
    case MapEventId.MAELSTROM: return '漩涡';
    case MapEventId.BATTLE: return '战斗';
    case MapEventId.BOSS: return 'BOSS';
    case MapEventId.AVOID: return '无战斗';
    case MapEventId.AIR_BATTLE: return '航空战';
    case MapEventId.ESCORT_SUCCESS: return '护卫成功';
    case MapEventId.TRANSPORT: return '输送物资';
    case MapEventId.AIR_RAID: return '空袭战';
    case MapEventId.LONG_AIR_RAID: return '长距离空袭战';
    case MapEventId.NIGHT_RAID: return '雷达射击';
    case MapEventId.ANCHORAGE: return '泊地修理';
    case MapEventId.SELECTOR: return '能动分歧';
    default: return `事件${eventId}`;
  }
}
/**
 * 获取事件 Kind 的描述
 */
export function getEventKindDesc(eventKind: number): string {
  switch (eventKind) {
    case MapEventKind.NONE: return '';
    case MapEventKind.DAY_BATTLE: return '昼战';
    case MapEventKind.NIGHT_BATTLE: return '夜战';
    case MapEventKind.NIGHT_TO_DAY: return '夜战→昼战';
    case MapEventKind.AIR_BATTLE: return '航空战';
    case MapEventKind.COMBINED: return '联合舰队战';
    case MapEventKind.LONG_AIR_RAID: return '长距离空袭战';
    default: return '';
  }
}
/**
 * 获取完整的事件描述
 */
export function getFullEventDesc(eventId: number, eventKind: number): string {
  // APIList 中 eventKind 依赖 eventId 解释，不能作为全局节点类型直接映射。
  // 旧式能动分歧使用 6/2；第二期数据也可能直接使用 eventId=14。
  if (eventId === MapEventId.AVOID) {
    return eventKind === MapEventKind.NIGHT_BATTLE ? '能动分歧' : '无战斗';
  }

  // eventId=7 同时承载航空侦察和航空战；kind=0 表示航空侦察。
  if (eventId === MapEventId.AIR_BATTLE) {
    return eventKind === MapEventKind.NONE ? '航空侦察' : '航空战';
  }

  const idDesc = getEventIdDesc(eventId);
  if (eventId !== MapEventId.BATTLE && eventId !== MapEventId.BOSS) {
    return idDesc;
  }

  const kindDesc = getEventKindDesc(eventKind);
  if (kindDesc && kindDesc !== idDesc) {
    return `${idDesc}(${kindDesc})`;
  }
  return idDesc;
}
/**
 * 判断是否是战斗事件
 */
export function isBattleEventId(eventId: number, eventKind: number = MapEventKind.NONE): boolean {
  if (eventId === MapEventId.AIR_BATTLE) {
    return eventKind !== MapEventKind.NONE;
  }

  return eventId === MapEventId.BATTLE
    || eventId === MapEventId.BOSS
    || eventId === MapEventId.AIR_RAID
    || eventId === MapEventId.LONG_AIR_RAID
    || eventId === MapEventId.NIGHT_RAID;
}
