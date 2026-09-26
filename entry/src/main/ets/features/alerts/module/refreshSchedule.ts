/** Game deadlines use JST (UTC+9), independently of the device's timezone. */
export type RefreshReminderKind = 'practice' | 'senka' | 'eo';
export const REFRESH_REMINDER_KINDS: RefreshReminderKind[] = ['practice', 'senka', 'eo'];
export const REFRESH_REMINDER_PREFIX = 'kchomo.refresh.v1.';
export const REFRESH_REMINDER_STATUS = 'alerts.refresh.status';
const HOUR = 3600000;
const JST = 9 * HOUR;

export function refreshReminderKey(kind: RefreshReminderKind): string {
  return `alerts.refresh.${kind}.enabled`;
}

export interface RefreshReminderTarget {
  kind: RefreshReminderKind;
  groupId: string;
  notificationId: number;
  remindAt: number;
  deadline: number;
  title: string;
  content: string;
}

function target(kind: RefreshReminderKind, id: number, remindAt: number, deadline: number,
  title: string, content: string): RefreshReminderTarget {
  const local = new Date(remindAt);
  const occurrence = `${remindAt}`;
  return { kind, groupId: `${REFRESH_REMINDER_PREFIX}${kind}.${occurrence}.${local.getTimezoneOffset()}`,
    notificationId: id, remindAt, deadline, title, content };
}

export function refreshReminderTargets(kind: RefreshReminderKind, now: number): RefreshReminderTarget[] {
  const date = new Date(now + JST);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const result: RefreshReminderTarget[] = [];
  if (kind === 'practice') {
    // The settings show Beijing time; only register occurrences on that calendar day.
    const today = new Date(now + 8 * HOUR);
    for (const hour of [3, 15]) {
      const deadline = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour) - JST;
      // Keep an already-due reminder until refresh; sync never creates reminders in the past.
      if (deadline <= now) continue;
      result.push(target(kind, hour === 3 ? 4000 : 4001, deadline - 15 * 60000, deadline,
        '演习刷新提醒', `演习将在 15 分钟后刷新（北京时间 ${hour === 3 ? '02:00' : '14:00'}），请及时完成本轮演习。`));
    }
    return result;
  }
  // 22 monthly + up to 2 same-day requests leave space for expeditions and both supply stages.
  // Refill this rolling 11-month window while the app runs; registered reminders survive exit.
  for (let offset = 0; result.length < 11; offset++) {
    const nextMonth = Date.UTC(year, month + offset + 1, 1) - JST;
    const deadline = kind === 'senka' ? nextMonth - 2 * HOUR : nextMonth;
    if (deadline <= now) continue;
    const remindAt = deadline - (kind === 'senka' ? HOUR / 2 : 3 * HOUR);
    const occurrenceMonth = new Date(nextMonth - 1 + JST).getUTCMonth();
    result.push(target(kind, (kind === 'senka' ? 4100 : 4200) + occurrenceMonth, remindAt, deadline,
      kind === 'senka' ? '月度战果结算提醒' : '月底 EO 勋章提醒',
      kind === 'senka' ? '距离本月战果周期结算还有 30 分钟（北京时间 21:00 截止）。' :
        '距离本月 EO 勋章获取截止还有 3 小时（北京时间 23:00 截止），请及时完成 EO 海域。'));
  }
  return result;
}
