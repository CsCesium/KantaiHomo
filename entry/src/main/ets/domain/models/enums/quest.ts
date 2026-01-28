/**
 * 任务分类枚举 (api_category)
 */
export enum QuestCategory {
  /** 編成 - Composition */
  COMPOSITION = 1,
  /** 出撃 - Sortie */
  SORTIE = 2,
  /** 演習 - Practice */
  PRACTICE = 3,
  /** 遠征 - Expedition */
  EXPEDITION = 4,
  /** 補給/入渠 - Supply/Docking */
  SUPPLY = 5,
  /** 工廠 - Arsenal */
  ARSENAL = 6,
  /** 改装 - Modernization */
  MODERNIZATION = 7,
  /** 出撃(2) - Sortie (Extended) */
  SORTIE_2 = 8,
  /** 出撃(3) - Sortie (Special) */
  SORTIE_3 = 9,
}

/** 任务分类名称 (日文) */
export const QuestCategoryNameJP: Record<QuestCategory, string> = {
  [QuestCategory.COMPOSITION]: '編成',
  [QuestCategory.SORTIE]: '出撃',
  [QuestCategory.PRACTICE]: '演習',
  [QuestCategory.EXPEDITION]: '遠征',
  [QuestCategory.SUPPLY]: '補給/入渠',
  [QuestCategory.ARSENAL]: '工廠',
  [QuestCategory.MODERNIZATION]: '改装',
  [QuestCategory.SORTIE_2]: '出撃',
  [QuestCategory.SORTIE_3]: '出撃',
};

/** 任务分类颜色 (Hex) */
export const QuestCategoryColor: Record<QuestCategory, string> = {
  [QuestCategory.COMPOSITION]: '#22AA44',   // 绿
  [QuestCategory.SORTIE]: '#CC4444',        // 红
  [QuestCategory.PRACTICE]: '#44AA44',      // 浅绿
  [QuestCategory.EXPEDITION]: '#44AAAA',    // 青
  [QuestCategory.SUPPLY]: '#AAAA44',        // 黄
  [QuestCategory.ARSENAL]: '#AA6644',       // 棕
  [QuestCategory.MODERNIZATION]: '#AA44AA', // 紫
  [QuestCategory.SORTIE_2]: '#CC4444',      // 红
  [QuestCategory.SORTIE_3]: '#CC4444',      // 红
};

/**
 * 任务重置周期枚举 (api_type)
 */
export enum QuestResetType {
  /** 单次任务 */
  ONCE = 1,
  /** 每日任务 */
  DAILY = 2,
  /** 每周任务 */
  WEEKLY = 3,
  /** 每月任务 (出现在 -3 日) */
  MONTHLY_3 = 4,
  /** 每月任务 (出现在 -2 日) */
  MONTHLY_2 = 5,
  /** 每月任务 */
  MONTHLY = 6,
  /** 季度任务 */
  QUARTERLY = 7,
  /** 年度任务 (2月) */
  YEARLY_FEB = 8,
  /** 年度任务 (8月) */
  YEARLY_AUG = 9,
  /** 年度任务 (3月) */
  YEARLY_MAR = 10,
  /** 年度任务 (9月) */
  YEARLY_SEP = 11,
}

/** 任务周期名称 */
export const QuestResetTypeNameJP: Record<QuestResetType, string> = {
  [QuestResetType.ONCE]: '単発',
  [QuestResetType.DAILY]: 'デイリー',
  [QuestResetType.WEEKLY]: 'ウィークリー',
  [QuestResetType.MONTHLY_3]: 'マンスリー',
  [QuestResetType.MONTHLY_2]: 'マンスリー',
  [QuestResetType.MONTHLY]: 'マンスリー',
  [QuestResetType.QUARTERLY]: 'クォータリー',
  [QuestResetType.YEARLY_FEB]: 'イヤーリー',
  [QuestResetType.YEARLY_AUG]: 'イヤーリー',
  [QuestResetType.YEARLY_MAR]: 'イヤーリー',
  [QuestResetType.YEARLY_SEP]: 'イヤーリー',
};

export const QuestResetTypeShort: Record<QuestResetType, string> = {
  [QuestResetType.ONCE]: '単',
  [QuestResetType.DAILY]: '日',
  [QuestResetType.WEEKLY]: '週',
  [QuestResetType.MONTHLY_3]: '月',
  [QuestResetType.MONTHLY_2]: '月',
  [QuestResetType.MONTHLY]: '月',
  [QuestResetType.QUARTERLY]: '季',
  [QuestResetType.YEARLY_FEB]: '年',
  [QuestResetType.YEARLY_AUG]: '年',
  [QuestResetType.YEARLY_MAR]: '年',
  [QuestResetType.YEARLY_SEP]: '年',
};

/**
 * 任务状态枚举 (api_state)
 */
export enum QuestState {
  /** 未接受/不可见 */
  LOCKED = 1,
  /** 已接受/进行中 */
  ACTIVE = 2,
  /** 已完成 */
  COMPLETE = 3,
}

/**
 * 任务进度标记 (api_progress_flag)
 */
export enum QuestProgress {
  /** 无进度/未显示 */
  NONE = 0,
  /** 50% 以上 */
  HALF = 1,
  /** 80% 以上 */
  ALMOST = 2,
}

/** 是否为周期性任务（每日/每周/每月等） */
export function isRecurringQuest(type: QuestResetType): boolean {
  return type !== QuestResetType.ONCE;
}

/** 是否为每日任务 */
export function isDailyQuest(type: QuestResetType): boolean {
  return type === QuestResetType.DAILY;
}

/** 是否为每周任务 */
export function isWeeklyQuest(type: QuestResetType): boolean {
  return type === QuestResetType.WEEKLY;
}

/** 是否为每月任务 */
export function isMonthlyQuest(type: QuestResetType): boolean {
  return type === QuestResetType.MONTHLY_3
    || type === QuestResetType.MONTHLY_2
    || type === QuestResetType.MONTHLY;
}

/** 是否为季度任务 */
export function isQuarterlyQuest(type: QuestResetType): boolean {
  return type === QuestResetType.QUARTERLY;
}

/** 是否为年度任务 */
export function isYearlyQuest(type: QuestResetType): boolean {
  return type === QuestResetType.YEARLY_FEB
    || type === QuestResetType.YEARLY_AUG
    || type === QuestResetType.YEARLY_MAR
    || type === QuestResetType.YEARLY_SEP;
}
