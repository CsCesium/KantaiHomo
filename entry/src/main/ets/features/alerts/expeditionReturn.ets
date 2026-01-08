//entry/src/main/ets/features/alerts/expeditionReturn.ets
import type { Clock, Cancelable, Notifier, ExpeditionDaoLike, ExpeditionNext ,TimeoutId } from './type';

class TimeoutHandle implements Cancelable {
  private id: TimeoutId;
  constructor(id: TimeoutId) { this.id = id; }
  cancel(): void { clearTimeout(this.id); }
}

export class SystemClock implements Clock {
  now(): number { return Date.now(); }
  setTimeout(cb: () => void, ms: number): Cancelable {
    const id: TimeoutId = setTimeout(cb, ms);
    return new TimeoutHandle(id);
  }
  clearTimeout(handle: Cancelable): void { handle.cancel(); }
}

export interface ExpeditionReturnSchedulerOptions {
  minDelayMs: number;
  maxSnoozeMs: number;
}

export class ExpeditionReturnScheduler {
  private readonly dao: ExpeditionDaoLike;
  private readonly notifier: Notifier;
  private readonly clock: Clock;
  private readonly opts: ExpeditionReturnSchedulerOptions;

  private running: boolean = false;
  private pending: Cancelable | null = null;
  private lastPlannedDeck: number = -1;
  private lastPlannedMission: number = -1;
  private lastPlannedWhen: number = 0;

  constructor(dao: ExpeditionDaoLike, notifier: Notifier, clock: Clock, opts: ExpeditionReturnSchedulerOptions) {
    this.dao = dao;
    this.notifier = notifier;
    this.clock = clock;
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.planNext();
  }

  stop(): void {
    this.running = false;
    if (this.pending) {
      this.pending.cancel();
      this.pending = null;
    }
  }

  async poke(): Promise<void> {
    if (!this.running) return;
    await this.planNext();
  }

  private clearPending(): void {
    if (this.pending) {
      this.pending.cancel();
      this.pending = null;
    }
  }

  private async planNext(): Promise<void> {
    this.clearPending();

    const now: number = this.clock.now();
    const next: ExpeditionNext | null = await this.dao.getNextExpeditionAfter(now);
    if (next == null) {
      const delay: number = 60000;
      this.pending = this.clock.setTimeout(() => { void this.planNext(); }, delay);
      this.lastPlannedDeck = -1;
      this.lastPlannedMission = -1;
      this.lastPlannedWhen = 0;
      return;
    }

    let fireAt: number = next.returnTime;
    const minDelay: number = this.opts.minDelayMs;
    const maxSnooze: number = this.opts.maxSnoozeMs;

    if (fireAt < now) {
      const overdue: number = now - fireAt;
      if (overdue <= maxSnooze) {
        fireAt = now + minDelay;
      } else {
        const delay: number = 60000;
        this.pending = this.clock.setTimeout(() => { void this.planNext(); }, delay);
        return;
      }
    }

    const waitMs: number = Math.max(minDelay, fireAt - now);
    this.lastPlannedDeck = next.deckId;
    this.lastPlannedMission = next.missionId;
    this.lastPlannedWhen = fireAt;

    this.pending = this.clock.setTimeout(async () => {
      await this.fire(next.deckId, next.missionId, fireAt);
      if (this.running) {
        await this.planNext();
      }
    }, waitMs);
  }

  private async fire(deckId: number, missionId: number, when: number): Promise<void> {
    await this.notifier.notifyExpeditionReturn(deckId, missionId, when);
  }

  getPlanned(): ExpeditionNext | null {
    if (this.lastPlannedDeck <= 0 || this.lastPlannedWhen <= 0) return null;
    return { deckId: this.lastPlannedDeck, missionId: this.lastPlannedMission, returnTime: this.lastPlannedWhen };
  }
}