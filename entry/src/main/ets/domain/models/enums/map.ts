/**
 * Map Event 类型枚举和描述
 *
 * 来自 api_event_id 和 api_event_kind
 */
// ========== Event ID (api_event_id) ==========
export const MapEventId = {
  /** 无事件/起点 */
  NONE: 0,
  /** 资源获取 */
  RESOURCE: 2,
  /** 漩涡 (资源损失) */
  MAELSTROM: 3,
  /** 战斗 */
  BATTLE: 4,
  /** Boss 战斗 */
  BOSS: 5,
  /** 气象 (能动分歧) */
  SELECTOR: 6,
  /** 航空战 */
  AIR_BATTLE: 7,
  /** 船渠 (能动分歧) */
  ANCHORAGE: 8,
  /** 空袭 */
  AIR_RAID: 9,
  /** 长距离空袭 */
  LONG_AIR_RAID: 10,
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
  /** 联合舰队 */
  COMBINED: 5,
  /** 空袭战 */
  AIR_RAID: 6,
  /** 长距离空袭 */
  LONG_AIR_RAID: 7,
} as const;

export type MapEventKindType = typeof MapEventKind[keyof typeof MapEventKind];
// ========== 事件描述 ==========

/**
 * 获取事件 ID 的描述
 */
export function getEventIdDesc(eventId: number): string {
  switch (eventId) {
    case MapEventId.NONE: return '起点';
    case MapEventId.RESOURCE: return '资源';
    case MapEventId.MAELSTROM: return '漩涡';
    case MapEventId.BATTLE: return '战斗';
    case MapEventId.BOSS: return 'BOSS';
    case MapEventId.SELECTOR: return '能动分歧';
    case MapEventId.AIR_BATTLE: return '航空战';
    case MapEventId.ANCHORAGE: return '泊地';
    case MapEventId.AIR_RAID: return '空袭';
    case MapEventId.LONG_AIR_RAID: return '长距离空袭';
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
    case MapEventKind.COMBINED: return '联合舰队';
    case MapEventKind.AIR_RAID: return '空袭战';
    case MapEventKind.LONG_AIR_RAID: return '长距离空袭';
    default: return '';
  }
}
/**
 * 获取完整的事件描述
 */
export function getFullEventDesc(eventId: number, eventKind: number): string {
  const idDesc = getEventIdDesc(eventId);
  const kindDesc = getEventKindDesc(eventKind);

  if (kindDesc && kindDesc !== idDesc) {
    return `${idDesc}(${kindDesc})`;
  }
  return idDesc;
}
/**
 * 判断是否是战斗事件
 */
export function isBattleEventId(eventId: number): boolean {
  return eventId === MapEventId.BATTLE
    || eventId === MapEventId.BOSS
    || eventId === MapEventId.AIR_BATTLE
    || eventId === MapEventId.AIR_RAID
    || eventId === MapEventId.LONG_AIR_RAID;
}