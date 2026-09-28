/**
 * 日历提醒的用户可配置项。
 *
 * 通知时长指写入系统日历的日程长度（endTime - startTime）。1 分钟的日程在系统日历里
 * 几乎一闪而过，拉长后提醒条目在这段时间内保持活跃。
 * 重要提醒把日程登记为 Calendar Kit 的「重要事项」（EventType.IMPORTANT），
 * 由系统日历以闹铃方式响铃；关闭则为普通通知。
 */
export const CALENDAR_IMPORTANT_KEY = 'alerts.calendar.important';
export const CALENDAR_DURATION_KEY = 'alerts.calendar.durationMin';

/** 默认关闭：不擅自把用户已有的提醒变成闹铃。 */
export const CALENDAR_IMPORTANT_DEFAULT = false;

export const CALENDAR_DURATION_MIN_MINUTES = 15;
export const CALENDAR_DURATION_MAX_MINUTES = 360;
export const CALENDAR_DURATION_STEP_MINUTES = 15;
export const CALENDAR_DURATION_DEFAULT_MINUTES = 30;

const MINUTES_PER_HOUR = 60;
export const MINUTE_MS = 60000;

export function normalizeCalendarDurationMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return CALENDAR_DURATION_DEFAULT_MINUTES;
  }
  const stepped: number =
    Math.round(value / CALENDAR_DURATION_STEP_MINUTES) * CALENDAR_DURATION_STEP_MINUTES;
  return Math.min(
    CALENDAR_DURATION_MAX_MINUTES,
    Math.max(CALENDAR_DURATION_MIN_MINUTES, stepped),
  );
}

export function calendarDurationMs(minutes: number): number {
  return normalizeCalendarDurationMinutes(minutes) * MINUTE_MS;
}

export function formatCalendarDuration(minutes: number): string {
  const total: number = normalizeCalendarDurationMinutes(minutes);
  const hours: number = Math.floor(total / MINUTES_PER_HOUR);
  const rest: number = total % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${rest} 分钟`;
  }
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}
