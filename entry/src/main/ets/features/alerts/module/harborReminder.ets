import notificationManager from '@ohos.notificationManager';
import promptAction from '@ohos.promptAction';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { calendarReminder } from './calendarReminder';
import { getGameState } from '../../state';
import { getAlertBus } from '../bus';
import { kvGetBool, kvGetString, kvSet } from '../../../infra/storage/kv';
import type { ApiDump } from '../../../infra/web/types';
import { parseSvdata, parseFormBody } from '../../utils/common';
import { getSortieContext } from '../../../domain/service/sortie';
import { formatExpeditionReturnTime } from './expeditionTime';
import {
  HarborTimer, HarborTimerView, HarborFleet, HARBOR_TIMER_ENABLED,
  HARBOR_TIMER_KINDS, eligibleHarborFleets, harborFlagshipKind, HarborTimerKind,
  harborReminderMinutesKey, normalizeHarborReminderMinutes, parseHarborReminderMinutes,
} from './harborTimer';

const PREFIX = 'kchomo.harbor.';
interface HarborResponse { api_result?: number; }
export interface HarborNotification { title: string; }

export function harborFlagships(): HarborFleet[] {
  const state = getGameState().getState();
  const fleets: HarborFleet[] = [];
  for (const deck of state.decks) {
    const flagship = state.ships.get(deck.shipUids[0]);
    const kind = harborFlagshipKind(flagship?.name ?? '');
    if (kind && flagship) fleets.push({ kind, deckId: deck.deckId, flagship: flagship.name });
  }
  return fleets;
}

class HarborReminderService {
  private engine = new HarborTimer();
  private account = '';
  private confirmed = false;
  private enabled = true;
  private foreground = true;
  private running = false;
  private timer: number | null = null;
  private tail: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private practiceDeck = 0;
  private saved = '';
  private repairMinutes: number[] = [20];
  private supplyMinutes: number[] = [15, 30];

  private async loadOptions(): Promise<void> {
    this.enabled = await kvGetBool(HARBOR_TIMER_ENABLED, true);
    this.repairMinutes = parseHarborReminderMinutes('repair', await kvGetString(harborReminderMinutesKey('repair'), ''));
    this.supplyMinutes = parseHarborReminderMinutes('supply', await kvGetString(harborReminderMinutesKey('supply'), ''));
    AppStorage.setOrCreate(HARBOR_TIMER_ENABLED, this.enabled);
  }

  setReminderMinutes(kind: HarborTimerKind, minutes: number[]): Promise<void> {
    const next = normalizeHarborReminderMinutes(kind, minutes);
    return this.enqueue(async () => {
      await this.loadOptions();
      const previous = kind === 'repair' ? this.repairMinutes : this.supplyMinutes;
      await kvSet(harborReminderMinutesKey(kind), JSON.stringify(next));
      if (kind === 'repair') this.repairMinutes = next;
      else this.supplyMinutes = next;
      // 新选的时刻已经过去时不补发，也不重置游戏计时起点。
      for (const view of this.views()) {
        if (view.kind === kind && !previous.includes(view.minutes) && view.dueAt <= Date.now()) {
          const stage = this.engine.stage(view);
          stage.toastShown = true;
          stage.notificationSent = true;
        }
      }
      await this.reconcile();
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      this.schedule();
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private changed(): void { this.listeners.forEach(listener => listener()); }
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.tail.then(operation);
    this.tail = next.catch((error: Error) => { console.warn('[HarborReminder]', String(error)); });
    return next;
  }
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.sync();
    this.schedule();
  }
  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  setForeground(value: boolean): void { this.foreground = value; void this.sync(); }
  private schedule(): void {
    if (!this.running) return;
    const future = this.views().map(view => view.dueAt - Date.now()).filter(ms => ms > 0);
    const delay = Math.max(50, Math.min(30000, ...future));
    this.timer = setTimeout(async () => { this.timer = null; await this.sync(); this.schedule(); }, delay) as number;
  }
  sync(): Promise<void> {
    return this.enqueue(async () => {
      await this.loadOptions();
      await this.reconcile();
    }).catch(() => undefined);
  }
  setEnabled(enabled: boolean): Promise<void> {
    return this.enqueue(async () => {
      await kvSet(HARBOR_TIMER_ENABLED, enabled);
      await this.loadOptions();
      await this.reconcile();
    });
  }

  afterApi(dump: ApiDump, before: HarborFleet[]): Promise<void> {
    const endpoint = dump.url.match(/(\/api_[^?#]+)/)?.[1] ?? '';
    if (!/\/api_(port\/port|req_hensei\/|req_kaisou\/|req_hokyu\/|req_nyukyo\/|req_mission\/|req_map\/start|req_practice\/|get_member\/)/.test(endpoint)) return Promise.resolve();
    if (parseSvdata<HarborResponse>(dump.responseText)?.api_result !== 1) return Promise.resolve();
    // Capture the API's fleet and timestamp before calendar work can delay it.
    const key = String(getGameState().getState().admiral?.memberId ?? '');
    const now = Date.now();
    const current = harborFlagships();
    const params = parseFormBody(dump.requestBody);
    return this.enqueue(async () => {
      await this.loadOptions();
      if (!key) return;
      if (key !== this.account) {
        this.account = key; this.confirmed = false; this.practiceDeck = 0;
        this.saved = await kvGetString(`alerts.harbor.clock.${key}`, '');
        try { this.engine.restore(this.saved, Date.now()); }
        catch (_) { this.engine.restore('', Date.now()); }
      }
      const isPort = endpoint === '/api_port/port';
      if (!isPort && !this.confirmed) return;
      this.engine.observe(current.map(fleet => fleet.kind), now);
      if (isPort) {
        this.confirmed = true; this.practiceDeck = 0;
        this.engine.port(current, now);
      } else if (endpoint === '/api_req_hensei/change' && params.getInt('api_ship_id', 0) !== -2) {
        // Preset changes and bulk removal do not reset the game's shared repair/supply clocks.
        const deckId = params.getInt('api_id', 0);
        for (const kind of HARBOR_TIMER_KINDS) {
          if ([...before, ...current].some(fleet => fleet.deckId === deckId && fleet.kind === kind)) this.engine.reset(kind, now);
        }
      } else if (/\/api_req_practice\/(battle|midnight_battle)$/.test(endpoint)) {
        this.practiceDeck = params.getInt('api_deck_id', 1);
      }
      await this.save();
      await this.reconcile();
      // Re-arm for the precise threshold after fleet edits, instead of waiting for a 30s tick.
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      this.schedule();
    }).catch((error: Error) => { console.warn('[HarborReminder] API tracking:', String(error)); });
  }

  private views(): HarborTimerView[] {
    if (!this.enabled || !this.confirmed) return [];
    const state = getGameState().getState();
    const sortie = getSortieContext();
    const away = sortie ? [sortie.deckId, ...(sortie.combinedType > 0 ? [2] : [])] : [];
    if (this.practiceDeck > 0) away.push(this.practiceDeck);
    return this.engine.views(eligibleHarborFleets(state, away), this.repairMinutes, this.supplyMinutes);
  }
  notification(): HarborNotification | null {
    const now = Date.now();
    const all = this.views();
    const views = all.filter(view => {
      const sameKind = all.filter(item => item.kind === view.kind);
      const next = sameKind.find(item => item.dueAt > now) ?? sameKind[sameKind.length - 1];
      return view.minutes === next.minutes;
    });
    if (views.length === 0) return null;
    const first = views[0];
    return {
      title: `${first.kind === 'repair' ? '维修' : '给粮'}：${first.dueAt <= now ? '可回港' : formatExpeditionReturnTime(first.dueAt)}（${first.flagship} · ${first.minutes}分）`,
    };
  }
  private async save(): Promise<void> {
    if (!this.account) return;
    const value = this.engine.serialize();
    if (value !== this.saved) { await kvSet(`alerts.harbor.clock.${this.account}`, value); this.saved = value; }
  }
  private group(view: HarborTimerView): string {
    const suffix = view.finalSupply ? '.30' :
      (view.minutes === (view.kind === 'repair' ? 20 : 15) ? '' : `.m${view.minutes}`);
    return `${PREFIX}${this.account}.${view.kind}.${view.startedAt}${suffix}`;
  }
  private async cancel(id: number): Promise<void> {
    try { await calendarReminder.cancelReminder(id); }
    catch (error) {
      const failure = error as BusinessError;
      if (failure.code !== 1700003) throw new Error(`cancel harbor reminder: ${failure.code}`);
    }
  }
  private async reconcile(): Promise<void> {
    if (!this.confirmed && this.enabled) return; // Wait for a fresh port snapshot before trusting cached fleets.
    const views = this.views();
    this.changed();
    const valid = await calendarReminder.getAllValidReminders();
    const kept = new Set<string>();
    for (const reminder of valid) {
      const group = reminder.reminderReq.groupId ?? '';
      if (!group.startsWith(PREFIX)) continue;
      if (views.some(view => this.group(view) === group) && !kept.has(group)) kept.add(group);
      else await this.cancel(reminder.reminderId);
    }
    const permission = await calendarReminder.isEnabled();
    for (const kind of HARBOR_TIMER_KINDS) {
      const clock = this.engine.clock(kind);
      if (clock && !views.some(view => view.kind === kind)) {
        clock.systemScheduled = false;
        if (clock.supplyFinal) clock.supplyFinal.systemScheduled = false;
        clock.extraStages?.forEach(stage => { stage.systemScheduled = false; });
      }
    }
    const processed = new Set<string>();
    for (const view of views) {
      const kind = view.kind;
      const clock = this.engine.stage(view);
      const group = this.group(view);
      if (processed.has(group)) continue;
      processed.add(group);
      if (kept.has(group)) clock.systemScheduled = true;
      const label = kind === 'repair' ? '明石维修' : '野埼给粮';
      const body = `${views.filter(item => item.kind === kind && item.minutes === view.minutes).map(item => `第${item.deckId}舰队`).join('、')}已等待 ${view.minutes} 分钟，可回母港${kind === 'repair' ? '泊地维修' : '士气提升'}。${kind === 'supply' ? '士气恢复上限为 54。' : ''}`;
      const id = view.finalSupply ? 4302 : (kind === 'repair' ?
        (view.minutes === 20 ? 4300 : 4400 + view.minutes) : (view.minutes === 15 ? 4301 : 4500 + view.minutes));
      if (view.dueAt > Date.now() && !kept.has(group) && permission) {
        const date = new Date(Math.ceil(view.dueAt / 1000) * 1000);
        const request: reminderAgentManager.ReminderRequestCalendar = {
          reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
          dateTime: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() },
          notificationId: id, groupId: group, title: `${label}计时到点`, content: body, expiredContent: body,
          slotType: notificationManager.SlotType.CONTENT_INFORMATION, ringDuration: 0, snoozeTimes: 0, tapDismissed: true,
          wantAgent: { pkgName: 'io.github.cesium.kchomo', abilityName: 'EntryAbility' },
        };
        try { await calendarReminder.publishReminder(request); clock.systemScheduled = true; }
        catch (error) { console.warn('[HarborReminder] publish failed:', String(error)); }
      }
      if (view.dueAt <= Date.now()) {
        // 恢复前台时，每类只补当前已到达的最新勾选档位。
        if (views.some(item => item.kind === kind && item.dueAt > view.dueAt && item.dueAt <= Date.now())) {
          clock.toastShown = true;
          clock.notificationSent = true;
          continue;
        }
        if (this.foreground && !clock.toastShown && getAlertBus().getConfig().enableToast) {
          promptAction.showToast({ message: body, duration: 3000 });
          clock.toastShown = true;
        }
        if (!clock.systemScheduled && !clock.notificationSent && await notificationManager.isNotificationEnabled()) {
          await notificationManager.publish({ id, notificationSlotType: notificationManager.SlotType.CONTENT_INFORMATION,
            tapDismissed: true, content: { notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
              normal: { title: `${label}计时到点`, text: body } } });
          clock.notificationSent = true;
        }
      }
    }
    await this.save();
  }
}
let instance: HarborReminderService | null = null;
export function getHarborReminderService(): HarborReminderService {
  if (!instance) instance = new HarborReminderService();
  return instance;
}
