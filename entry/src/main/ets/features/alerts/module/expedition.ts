/**
 * Expedition Return Scheduler
 *
 * 定时检查远征返回，触发提醒
 */
import { publishAlert } from "../bus";
import { Cancelable, Clock, ExpeditionDaoLike, ExpeditionNext, ExpeditionReturnAlert, TimeoutId } from "../type";


// ========== Clock 实现 ==========

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

// ========== Scheduler 配置 ==========

export interface ExpeditionSchedulerOptions {
  /** 最小延迟（毫秒），防止立即触发 */
  minDelayMs: number;
  /** 最大容忍过期时间（毫秒），超过则跳过 */
  maxSnoozeMs: number;
  /** 无远征时的轮询间隔（毫秒） */
  pollIntervalMs: number;
}

const DEFAULT_OPTIONS: ExpeditionSchedulerOptions = {
  minDelayMs: 500,
  maxSnoozeMs: 60000,
  pollIntervalMs: 60000,
};

// ========== Scheduler ==========

export class ExpeditionReturnScheduler {
  private readonly dao: ExpeditionDaoLike;
  private readonly clock: Clock;
  private readonly opts: ExpeditionSchedulerOptions;

  private running: boolean = false;
  private pending: Cancelable | null = null;
  private lastPlanned: ExpeditionNext | null = null;

  constructor(
    dao: ExpeditionDaoLike,
    clock: Clock = new SystemClock(),
    opts: Partial<ExpeditionSchedulerOptions> = {}
  ) {
    this.dao = dao;
    this.clock = clock;
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.info('[ExpeditionScheduler] started');
    await this.planNext();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    this.running = false;
    this.clearPending();
    this.lastPlanned = null;
    console.info('[ExpeditionScheduler] stopped');
  }

  /**
   * 手动触发重新调度（例如收到新的远征数据时调用）
   */
  async poke(): Promise<void> {
    if (!this.running) return;
    console.debug('[ExpeditionScheduler] poked, replanning...');
    await this.planNext();
  }

  /**
   * 获取当前计划的下一个远征
   */
  getPlanned(): ExpeditionNext | null {
    return this.lastPlanned ?  this.lastPlanned  : null;
  }

  /**
   * 是否正在运行
   */
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
    let next: ExpeditionNext | null = null;

    try {
      next = await this.dao.getNextAfter(now);
    } catch (e) {
      console.error('[ExpeditionScheduler] dao error:', e);
      // 出错时延迟重试
      this.scheduleRetry();
      return;
    }

    if (!next) {
      // 无远征，定时轮询
      console.debug('[ExpeditionScheduler] no expedition, polling later');
      this.pending = this.clock.setTimeout(
        () => { void this.planNext(); },
        this.opts.pollIntervalMs
      );
      this.lastPlanned = null;
      return;
    }

    let fireAt = next.returnTime;
    const minDelayMs = this.opts.minDelayMs;
    const maxSnoozeMs = this.opts.maxSnoozeMs;
    const pollIntervalMs = this.opts.pollIntervalMs;

    // 已过期
    if (fireAt < now) {
      const overdue = now - fireAt;
      if (overdue <= maxSnoozeMs) {
        // 在容忍范围内，立即触发（加最小延迟）
        fireAt = now + minDelayMs;
        console.debug(`[ExpeditionScheduler] overdue ${overdue}ms, firing soon`);
      } else {
        // 过期太久，跳过，稍后重新查询
        console.debug(`[ExpeditionScheduler] overdue ${overdue}ms > ${maxSnoozeMs}ms, skipping`);
        this.pending = this.clock.setTimeout(
          () => { void this.planNext(); },
          pollIntervalMs
        );
        this.lastPlanned = null;
        return;
      }
    }

    const waitMs = Math.max(minDelayMs, fireAt - now);
    this.lastPlanned = { ...next, returnTime: fireAt };

    console.debug(`[ExpeditionScheduler] scheduled deck=${next.deckId} in ${waitMs}ms`);

    this.pending = this.clock.setTimeout(async () => {
      await this.fire(next!.deckId, next!.missionId, fireAt);
      if (this.running) {
        await this.planNext();
      }
    }, waitMs);
  }

  private scheduleRetry(): void {
    this.pending = this.clock.setTimeout(
      () => { void this.planNext(); },
      5000  // 5 秒后重试
    );
  }

  private async fire(deckId: number, missionId: number, when: number): Promise<void> {
    console.info(`[ExpeditionScheduler] firing: deck=${deckId}, mission=${missionId}`);

    const alert: ExpeditionReturnAlert = {
      type: 'expedition_return',
      timestamp: when,
      deckId,
      missionId,
    };

    publishAlert(alert);
  }
}

// ========== 单例管理 ==========

let _scheduler: ExpeditionReturnScheduler | null = null;

export function getExpeditionScheduler(): ExpeditionReturnScheduler | null {
  return _scheduler;
}

export function initExpeditionScheduler(
  dao: ExpeditionDaoLike,
  clock?: Clock,
  opts?: Partial<ExpeditionSchedulerOptions>
): ExpeditionReturnScheduler {
  if (_scheduler) {
    _scheduler.stop();
  }
  _scheduler = new ExpeditionReturnScheduler(dao, clock, opts);
  return _scheduler;
}