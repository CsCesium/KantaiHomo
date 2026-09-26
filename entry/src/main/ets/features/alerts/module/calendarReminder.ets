import { calendarManager } from '@kit.CalendarKit';
import { abilityAccessCtrl, Permissions, common } from '@kit.AbilityKit';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { getAppContext } from '../../../infra/appContext';

export const CALENDAR_REMINDER_STATUS = 'alerts.calendar.status';
const ACCOUNT = 'io.github.cesium.kchomo.reminders';
const IDENTIFIER = 'kchomo.calendar.v1|';
const PERMISSIONS: Permissions[] = ['ohos.permission.READ_CALENDAR', 'ohos.permission.WRITE_CALENDAR'];
const EVENT_KEYS: (keyof calendarManager.Event)[] = [
  'id', 'type', 'title', 'description', 'startTime', 'endTime', 'identifier', 'recurrenceRule', 'reminderTime',
];

function owned(group: string): boolean {
  return group.startsWith('kchomo.expedition.') || group.startsWith('kchomo.refresh.v1.') || group.startsWith('kchomo.harbor.');
}

function decode(event: calendarManager.Event): reminderAgentManager.ReminderInfo | null {
  const identifier = event.identifier ?? '';
  if (!identifier.startsWith(IDENTIFIER) || event.id === undefined) return null;
  const parts = identifier.slice(IDENTIFIER.length).split('|');
  const notificationId = Number(parts[0]);
  const group = parts[1] ?? '';
  if (parts.length !== 2 || !Number.isInteger(notificationId) || !owned(group)) return null;
  const date = new Date(event.startTime);
  const request: reminderAgentManager.ReminderRequestCalendar = {
    reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
    groupId: group, notificationId, title: event.title, content: event.description ?? '',
    dateTime: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() },
  };
  // Do not infer recurrence from the group: new practice events are one-shot.
  if (event.recurrenceRule?.recurrenceFrequency === calendarManager.RecurrenceFrequency.DAILY) {
    request.daysOfWeek = [1, 2, 3, 4, 5, 6, 7];
  }
  // Agent IDs are non-negative; negative IDs identify our calendar events, including event ID zero.
  return { reminderId: -(event.id + 1), reminderReq: request };
}

/** Temporary calendar delivery, retaining existing agent reminders until their owners cancel them. */
class CalendarReminderService {
  private tail: Promise<void> = Promise.resolve();

  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.then(() => undefined).catch((error: Error) => {
      const failure = error as BusinessError;
      AppStorage.setOrCreate(CALENDAR_REMINDER_STATUS, `日历提醒失败：${failure.code ?? ''} ${failure.message}`);
      console.warn(`[CalendarReminder] ${failure.code ?? ''} ${failure.message}`);
    });
    return next;
  }

  async isEnabled(): Promise<boolean> {
    const access = abilityAccessCtrl.createAtManager();
    const token = getAppContext().applicationInfo.accessTokenId;
    for (const permission of PERMISSIONS) {
      if (await access.checkAccessToken(token, permission) !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
        AppStorage.setOrCreate(CALENDAR_REMINDER_STATUS, '请授权日历，才能登记关闭应用后的提醒');
        return false;
      }
    }
    return true;
  }

  async requestPermission(): Promise<boolean> {
    if (!await this.isEnabled()) {
      await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(getAppContext() as common.UIAbilityContext, PERMISSIONS);
    }
    if (!await this.isEnabled()) {
      AppStorage.setOrCreate(CALENDAR_REMINDER_STATUS, '日历未授权；如已拒绝，请在系统设置的应用权限中允许访问日历');
      return false;
    }
    return this.queue(async () => {
      const calendar = await this.calendar(true);
      if (!calendar) return false;
      // This is an explicit user action to enable reminders in our own calendar.
      await calendar.setConfig({ enableReminder: true });
      AppStorage.setOrCreate(CALENDAR_REMINDER_STATUS, '日历已授权；通知声音与振动遵循系统日历设置');
      return true;
    });
  }

  private async calendar(create: boolean): Promise<calendarManager.Calendar | undefined> {
    const manager = calendarManager.getCalendarManager(getAppContext());
    const calendars = await manager.getAllCalendars();
    const existing = calendars.find(item => item.getAccount().name === ACCOUNT && item.getAccount().type === calendarManager.CalendarType.LOCAL);
    if (existing || !create) return existing;
    const calendar = await manager.createCalendar({ name: ACCOUNT, type: calendarManager.CalendarType.LOCAL, displayName: '舰队提醒' });
    await calendar.setConfig({ enableReminder: true });
    return calendar;
  }

  getAllValidReminders(): Promise<reminderAgentManager.ReminderInfo[]> {
    return this.queue(async () => {
      let result: reminderAgentManager.ReminderInfo[] = [];
      try { result = await reminderAgentManager.getAllValidReminders(); }
      catch (error) {
        const failure = error as BusinessError;
        // Unsupported/unavailable agent APIs must not block the independent calendar backend.
        if (failure.code !== 201 && failure.code !== 801) throw new Error(`读取旧代理提醒失败：${failure.code} ${failure.message}`);
      }
      if (!await this.isEnabled()) return result;
      const calendar = await this.calendar(false);
      if (!calendar) return result;
      if (calendar.getConfig().enableReminder === false) {
        throw new Error('舰队提醒日历的提醒已关闭，请点击“授权日历并登记”重新开启');
      }
      // Omitting the filter is different from explicitly passing undefined to Calendar Kit's native bridge.
      const events = await calendar.getEvents();
      for (const event of events) {
        const info = decode(event);
        if (info) result.push(info);
      }
      AppStorage.setOrCreate(CALENDAR_REMINDER_STATUS, '使用“舰队提醒”日历；请保持系统日历通知开启');
      return result;
    });
  }

  publishReminder(request: reminderAgentManager.ReminderRequestCalendar): Promise<number> {
    return this.queue(async () => {
      if (!await this.isEnabled()) throw new Error('请先在设置中授权日历');
      const group = request.groupId ?? '';
      if (!owned(group)) throw new Error('不支持的提醒来源');
      const calendar = await this.calendar(true);
      if (!calendar || calendar.getConfig().enableReminder === false) throw new Error('请开启舰队提醒日历的提醒');
      const identifier = `${IDENTIFIER}${request.notificationId ?? 0}|${group}`;
      // Recover directly from the system calendar, including a restart immediately after addEvent.
      const events = await calendar.getEvents();
      const existing = events.find(event => event.identifier === identifier);
      if (existing?.id !== undefined) return -(existing.id + 1);
      const date = request.dateTime;
      const startTime = new Date(date.year, date.month - 1, date.day, date.hour, date.minute, date.second ?? 0).getTime();
      if (!Number.isFinite(startTime) || startTime <= Date.now()) throw new Error('提醒时间已过，请刷新后重试');
      const event: calendarManager.Event = {
        type: calendarManager.EventType.NORMAL, title: request.title ?? '舰队提醒',
        description: request.content ?? '', startTime, endTime: startTime + 60000,
        isAllDay: false, reminderTime: [0], identifier,
      };
      if (request.daysOfWeek && request.daysOfWeek.length > 0) {
        if (request.daysOfWeek.length !== 7) throw new Error('不支持的重复提醒规则');
        event.recurrenceRule = { recurrenceFrequency: calendarManager.RecurrenceFrequency.DAILY, interval: 1 };
      }
      const id = await calendar.addEvent(event);
      if (!Number.isInteger(id) || id < 0) throw new Error('系统日历未返回有效日程 ID');
      console.info(`[CalendarReminder] registered group=${group}, event=${id}, time=${startTime}`);
      return -(id + 1);
    });
  }

  cancelReminder(id: number): Promise<void> {
    return this.queue(async () => {
      if (id >= 0) { await reminderAgentManager.cancelReminder(id); return; }
      if (!await this.isEnabled()) throw new Error('日历权限已撤销，恢复授权后才能清理已登记提醒');
      const calendar = await this.calendar(false);
      if (!calendar) return;
      const eventId = -id - 1;
      const events = await calendar.getEvents(calendarManager.EventFilter.filterById([eventId]), EVENT_KEYS);
      const event = events.find(item => item.id === eventId);
      // Never delete events without our ownership marker, even inside our calendar.
      if (event && decode(event)) await calendar.deleteEvent(eventId);
    });
  }
}

export const calendarReminder = new CalendarReminderService();
