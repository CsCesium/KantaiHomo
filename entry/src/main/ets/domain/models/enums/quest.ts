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
 * 任务重置周期枚举 (api_label_type)
 *
 * questlist 的 api_type 是任务出现类型：1=日常, 2=周常, 3=月常, 4=单次, 5=其他。
 * 面板应使用 api_label_type 表示周期图标；缺失时用 questLabelTypeFromAppearanceType 转换。
 */
export enum QuestResetType {
  /** 单次任务 */
  ONCE = 1,
  /** 每日任务 */
  DAILY = 2,
  /** 每周任务 */
  WEEKLY = 3,
  /** 每月任务 */
  MONTHLY = 6,
  /** 季度任务 */
  QUARTERLY = 7,
  /** 年度任务 (2月) */
  YEARLY_FEB = 102,
  /** 年度任务 (3月) */
  YEARLY_MAR = 103,
}

/** 任务周期名称 */
export const QuestResetTypeNameJP: Record<number, string> = {
  [QuestResetType.ONCE]: '単発',
  [QuestResetType.DAILY]: 'デイリー',
  [QuestResetType.WEEKLY]: 'ウィークリー',
  [QuestResetType.MONTHLY]: 'マンスリー',
  [QuestResetType.QUARTERLY]: 'クォータリー',
  [QuestResetType.YEARLY_FEB]: 'イヤーリー',
  [QuestResetType.YEARLY_MAR]: 'イヤーリー',
};

export const QuestResetTypeShort: Record<number, string> = {
  [QuestResetType.ONCE]: '単',
  [QuestResetType.DAILY]: '日',
  [QuestResetType.WEEKLY]: '週',
  [QuestResetType.MONTHLY]: '月',
  [QuestResetType.QUARTERLY]: '季',
  [QuestResetType.YEARLY_FEB]: '年',
  [QuestResetType.YEARLY_MAR]: '年',
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

export function questLabelTypeFromAppearanceType(type: number): number {
  switch (type) {
    case 1: return QuestResetType.DAILY;
    case 2: return QuestResetType.WEEKLY;
    case 3: return QuestResetType.MONTHLY;
    case 4: return QuestResetType.ONCE;
    case 5: return QuestResetType.QUARTERLY;
    default: return type;
  }
}

/** 是否为周期性任务（每日/每周/每月等） */
export function isRecurringQuest(type: number): boolean {
  return type !== QuestResetType.ONCE;
}

/** 是否为每日任务 */
export function isDailyQuest(type: number): boolean {
  return type === QuestResetType.DAILY;
}

/** 是否为每周任务 */
export function isWeeklyQuest(type: number): boolean {
  return type === QuestResetType.WEEKLY;
}

/** 是否为每月任务 */
export function isMonthlyQuest(type: number): boolean {
  return type === QuestResetType.MONTHLY;
}

/** 是否为季度任务 */
export function isQuarterlyQuest(type: number): boolean {
  return type === QuestResetType.QUARTERLY;
}

/** 是否为年度任务 */
export function isYearlyQuest(type: number): boolean {
  return type >= 101 && type <= 112;
}
