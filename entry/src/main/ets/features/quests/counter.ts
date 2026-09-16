import type { QuestListPage } from '../../domain/models/struct/quest';
import type { QuestSnapshot } from '../state/type';
import type { QuestCountEvent, QuestCountRecord, QuestGoalDefinition, QuestProgressView } from './types';
import { matchesQuestGoal } from './goalMatcher';

const DAY = 86400000;
/** Game reset boundary is 05:00 JST (04:00 CST), independent of device timezone. */
export function questPeriod(type: number, time: number): string {
  const shifted = time + 4 * 3600000;
  const date = new Date(shifted);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (type === 1 || type === 8 || type === 9) return `d${Math.floor(shifted / DAY)}`;
  if (type === 2) return `w${Math.floor((shifted - 4 * DAY) / (7 * DAY))}`;
  if (type === 3) return `m${year}-${month}`;
  if (type === 4) return `q${Math.floor((year * 12 + month) / 3)}`;
  if (type >= 101 && type <= 112) return `y${year - (month < type - 100 ? 1 : 0)}`;
  return 'once';
}
function goalType(quest: QuestSnapshot, definition: QuestGoalDefinition | undefined): number {
  if (definition?.type) return definition.type;
  if (quest.type >= 101 && quest.type <= 112) return quest.type;
  if (quest.type === 2) return 1;
  if (quest.type === 3) return 2;
  if (quest.type === 6) return 3;
  if (quest.type === 7) return 4;
  return 0;
}

/** Only complete all/accepted lists can identify absent accepted quests. */
export class QuestPageAccumulator {
  private pages = new Map<number, QuestSnapshot[]>();
  private count = -1;
  private pageCount = -1;
  private tabId = -1;
  private activeCount: number | undefined;
  clear(): void {
    this.pages.clear(); this.count = -1; this.pageCount = -1; this.tabId = -1; this.activeCount = undefined;
  }
  collect(page: QuestListPage, rows: QuestSnapshot[]): QuestSnapshot[] | null {
    if (page.tabId !== 0 && page.tabId !== 9) { this.clear(); return null; }
    if (page.isComplete || new Set(rows.map(quest => quest.questId)).size === page.count) {
      this.clear(); return rows;
    }
    if (page.page === 1 || this.count !== page.count || this.pageCount !== page.pageCount ||
        this.tabId !== page.tabId || this.activeCount !== page.activeCount) {
      this.clear(); this.count = page.count; this.pageCount = page.pageCount;
      this.tabId = page.tabId; this.activeCount = page.activeCount;
    }
    if (page.page < 1 || page.page > page.pageCount) return null;
    this.pages.set(page.page, rows);
    if (this.pages.size !== page.pageCount) return null;
    const all: QuestSnapshot[] = [];
    for (let i = 1; i <= page.pageCount; i++) all.push(...(this.pages.get(i) ?? []));
    if (new Set(all.map(quest => quest.questId)).size !== page.count) return null;
    this.clear();
    return all;
  }
}

export class QuestCounter {
  private records = new Map<number, QuestCountRecord>();
  private definitions = new Map<number, QuestGoalDefinition>();
  readonly pages = new QuestPageAccumulator();
  constructor(definitions: QuestGoalDefinition[]) {
    definitions.forEach(def => this.definitions.set(def.id, def));
  }
  restore(text: string, now: number): void {
    this.records.clear();
    this.pages.clear();
    if (text) {
      const saved = JSON.parse(text) as QuestCountRecord[];
      if (!Array.isArray(saved)) throw new Error('Invalid quest counter storage');
      for (const record of saved) {
        if (record.quest?.questId > 0 && record.counts && typeof record.counts === 'object' &&
            !Array.isArray(record.counts) && typeof record.period === 'string') {
          for (const goal of this.definitions.get(record.quest.questId)?.goals ?? []) {
            const count = record.counts[goal.key];
            record.counts[goal.key] = Number.isFinite(count) ? Math.max(0, Math.min(goal.required, count)) : goal.init ?? 0;
          }
          record.estimated = true; // Other clients may have advanced the quest while this app was closed.
          this.records.set(record.quest.questId, record);
        }
      }
    }
    this.expire(now);
  }
  serialize(): string { return JSON.stringify(Array.from(this.records.values())); }
  quests(): QuestSnapshot[] { return Array.from(this.records.values()).map(record => record.quest); }

  expire(now: number): boolean {
    let changed = false;
    for (const [id, record] of this.records) {
      const definition = this.definitions.get(id);
      const period = questPeriod(goalType(record.quest, definition), now);
      const resetPeriod = questPeriod(definition?.resetInterval ?? 0, now);
      if (period !== record.period) {
        // Recurring quests are no longer accepted after their reset until the server says so.
        this.records.delete(id); changed = true;
      } else if (record.resetPeriod !== resetPeriod) {
        record.counts = {}; record.estimated = true; record.resetPeriod = resetPeriod; changed = true;
      }
    }
    if (changed) this.pages.clear();
    return changed;
  }
  sync(quests: QuestSnapshot[], now: number, replaceAll = false): void {
    this.expire(now);
    if (replaceAll) {
      const ids = new Set(quests.map(quest => quest.questId));
      // Absence may mean cancellation on another client. Hide it but retain its counters.
      for (const [id, record] of this.records) {
        if (!ids.has(id)) record.quest = { ...record.quest, state: 1 };
      }
    }
    for (const quest of quests) {
      const def = this.definitions.get(quest.questId);
      let record = this.records.get(quest.questId);
      if (!record) {
        record = { quest, counts: {}, estimated: true,
          period: questPeriod(goalType(quest, def), now), resetPeriod: questPeriod(def?.resetInterval ?? 0, now) };
        this.records.set(quest.questId, record);
      }
      record.quest = quest;
      for (const goal of def?.goals ?? []) {
        const saved = record.counts[goal.key];
        record.counts[goal.key] = Number.isFinite(saved) ? Math.max(0, Math.min(saved, goal.required)) : goal.init ?? 0;
        if (quest.state === 3) record.counts[goal.key] = goal.required;
      }
      if (quest.state === 3) record.estimated = false;
      else if (quest.state === 2 && def?.goals.length === 1 && quest.progress !== undefined) {
        const goal = def.goals[0];
        const min = quest.progress === 2 ? Math.ceil(goal.required * 0.8) :
          quest.progress === 1 ? Math.ceil(goal.required * 0.5) : 0;
        const max = quest.progress === 2 ? goal.required - 1 :
          quest.progress === 1 ? Math.ceil(goal.required * 0.8) - 1 : Math.ceil(goal.required * 0.5) - 1;
        const old = record.counts[goal.key];
        record.counts[goal.key] = Math.max(min, Math.min(old, Math.max(min, max)));
        if (min === max) record.estimated = false;
        else if (old !== record.counts[goal.key]) record.estimated = true;
      }
    }
  }
  /** Like poi, cap cached membership by the server total, retaining the latest confirmed quests. */
  reconcileActiveCount(activeCount: number | undefined, currentRows: QuestSnapshot[]): void {
    if (activeCount === undefined || !Number.isInteger(activeCount) || activeCount < 0) return;
    const confirmed = new Set(currentRows.filter(quest => quest.state === 2 || quest.state === 3)
      .map(quest => quest.questId));
    if (confirmed.size > activeCount) return; // Inconsistent response: do not hide confirmed rows.
    const active = Array.from(this.records.values()).filter(record => record.quest.state === 2 || record.quest.state === 3);
    active.sort((a, b) => Number(confirmed.has(b.quest.questId)) - Number(confirmed.has(a.quest.questId)) ||
      b.quest.capturedAt - a.quest.capturedAt);
    for (const record of active.slice(activeCount)) record.quest = { ...record.quest, state: 1 };
  }
  changeState(id: number, state: number, now: number): void {
    this.expire(now); this.pages.clear();
    const record = this.records.get(id);
    if (record) record.quest = { ...record.quest, state, capturedAt: now, updatedAt: now };
  }
  claim(id: number): void { this.records.delete(id); this.pages.clear(); }
  apply(events: QuestCountEvent[], now: number): boolean {
    let changed = this.expire(now);
    for (const record of this.records.values()) {
      if (record.quest.state !== 2) continue;
      for (const goal of this.definitions.get(record.quest.questId)?.goals ?? []) {
        for (const event of events) {
          if (!matchesQuestGoal(goal, event)) continue;
          const old = record.counts[goal.key] ?? goal.init ?? 0;
          const next = Math.min(goal.required, old + event.delta);
          if (next !== old) { record.counts[goal.key] = next; changed = true; }
        }
      }
    }
    return changed;
  }
  progress(id: number): QuestProgressView | null {
    const record = this.records.get(id);
    const def = this.definitions.get(id);
    if (!record || !def?.goals.length) return null;
    const counts = def.goals.map(goal => Math.min(goal.required, record.counts[goal.key] ?? goal.init ?? 0));
    const required = def.goals.reduce((sum, goal) => sum + goal.required, 0);
    const count = counts.reduce((sum, value) => sum + value, 0);
    const prefix = record.estimated ? '≈' : '';
    const items = def.goals.map((goal, i) => ({
      key: goal.key,
      description: goal.description ?? goal.event,
      label: `${prefix}${counts[i]}/${goal.required}`,
      satisfied: goal.required > 0 && counts[i] >= goal.required,
    }));
    return {
      label: `${prefix}${count}/${required}`,
      items,
      anySatisfied: items.some(item => item.satisfied),
      note: (record.estimated ? '≈ 为本地估算；接入前或在其他设备上的进度可能不完整。\n' : '') +
        '任务是否完成以游戏确认结果为准。',
    };
  }
}
