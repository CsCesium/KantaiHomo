/**
 * Repair Complete Scheduler
 *
 * 定时检查入渠修理完成，触发提醒
 */
import { publishAlert } from "../bus";
import { Cancelable, Clock, RepairDaoLike, RepairNext, RepairCompleteAlert, TimeoutId } from "../type";


// ========== Clock 实现 ==========

class TimeoutHandle implements Cancelable {
  private id: TimeoutId;
  constructor(id: TimeoutId) { this.id = id; }
  cancel(): void { clearTimeout(this.id); }
}

class SystemClock implements Clock {
  now(): number { return Date.now(); }
  setTimeout(cb: () => void, ms: number): Cancelable {
    const id: TimeoutId = setTimeout(cb, ms);
    return new TimeoutHandle(id);
  }
  clearTimeout(handle: Cancelable): void { handle.cancel(); }
}

// ========== Scheduler 配置 ==========

export interface RepairSchedulerOptions {
  /** 最小延迟（毫秒），防止立即触发 */
  minDelayMs: number;
  /** 最大容忍过期时间（毫秒），超过则跳过 */
  maxSnoozeMs: number;
  /** 无入渠时的轮询间隔（毫秒） */
  pollIntervalMs: number;
}

const DEFAULT_OPTIONS: RepairSchedulerOptions = {
  minDelayMs: 500,
  maxSnoozeMs: 60000,
  pollIntervalMs: 60000,
};

// ========== Scheduler ==========

export class RepairCompleteScheduler {
  private readonly dao: RepairDaoLike;
  private readonly clock: Clock;
  private readonly opts: RepairSchedulerOptions;

  private running: boolean = false;
  private pending: Cancelable | null = null;
  private lastPlanned: RepairNext | null = null;

  constructor(
    dao: RepairDaoLike,
    clock: Clock = new SystemClock(),
    opts: Partial<RepairSchedulerOptions> = {}
  ) {
    this.dao = dao;
    this.clock = clock;
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.info('[RepairScheduler] started');
    await this.planNext();
  }

  stop(): void {
    this.running = false;
    this.clearPending();
    this.lastPlanned = null;
    console.info('[RepairScheduler] stopped');
  }

  async poke(): Promise<void> {
    if (!this.running) return;
    console.debug('[RepairScheduler] poked, replanning...');
    await this.planNext();
  }

  getPlanned(): RepairNext | null {
    return this.lastPlanned;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ========== 内部方法 ==========

  private clearPending(): void {
    if (this.pending) {
      this.pending.cancel();
      this.pending = null;
    }
  }

  private async planNext(): Promise<void> {
    this.clearPending();

    const now = this.clock.now();
    let next: RepairNext | null = null;

    try {
      next = await this.dao.getNextAfter(now);
    } catch (e) {
      console.error('[RepairScheduler] dao error:', e);
      this.scheduleRetry();
      return;
    }

    if (!next) {
      console.debug('[RepairScheduler] no active repair, polling later');
      this.pending = this.clock.setTimeout(
        () => { void this.planNext(); },
        this.opts.pollIntervalMs
      );
      this.lastPlanned = null;
      return;
    }

    let fireAt = next.completeTime;
    const minDelayMs = this.opts.minDelayMs;
    const maxSnoozeMs = this.opts.maxSnoozeMs;
    const pollIntervalMs = this.opts.pollIntervalMs;

    if (fireAt < now) {
      const overdue = now - fireAt;
      if (overdue <= maxSnoozeMs) {
        fireAt = now + minDelayMs;
        console.debug(`[RepairScheduler] overdue ${overdue}ms, firing soon`);
      } else {
        console.debug(`[RepairScheduler] overdue ${overdue}ms > ${maxSnoozeMs}ms, skipping`);
        this.pending = this.clock.setTimeout(
          () => { void this.planNext(); },
          pollIntervalMs
        );
        this.lastPlanned = null;
        return;
      }
    }

    const waitMs = Math.max(minDelayMs, fireAt - now);
    this.lastPlanned = { ...next, completeTime: fireAt };

    console.debug(`[RepairScheduler] scheduled dock=${next.dockId} in ${waitMs}ms`);

    this.pending = this.clock.setTimeout(async () => {
      await this.fire(next!.dockId, next!.shipUid, fireAt);
      if (this.running) {
        await this.planNext();
      }
    }, waitMs);
  }

  private scheduleRetry(): void {
    this.pending = this.clock.setTimeout(
      () => { void this.planNext(); },
      5000
    );
  }

  private async fire(dockId: number, shipUid: number, when: number): Promise<void> {
    console.info(`[RepairScheduler] firing: dock=${dockId}, ship=${shipUid}`);

    const alert: RepairCompleteAlert = {
      type: 'repair_complete',
      timestamp: when,
      dockId,
      shipUid,
    };

    publishAlert(alert);
  }
}

// ========== 单例管理 ==========

let _scheduler: RepairCompleteScheduler | null = null;

export function getRepairScheduler(): RepairCompleteScheduler | null {
  return _scheduler;
}

export function initRepairScheduler(
  dao: RepairDaoLike,
  clock?: Clock,
  opts?: Partial<RepairSchedulerOptions>
): RepairCompleteScheduler {
  if (_scheduler) {
    _scheduler.stop();
  }
  _scheduler = new RepairCompleteScheduler(dao, clock, opts);
  return _scheduler;
}
