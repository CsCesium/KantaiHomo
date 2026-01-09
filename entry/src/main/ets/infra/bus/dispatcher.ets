export class Dispatcher<T> {
  private q: T[] = []
  private running = false
  private handlers: Array<(e: T) => Promise<void> | void>;

  constructor(handlers: Array<(e: T) => Promise<void> | void>) {
  this.handlers = handlers;
}

  post(e: T) {
    this.q.push(e)
    if (!this.running) void this.drain()
  }

  private async drain() {
    this.running = true
    while (this.q.length) {
      const e = this.q.shift()!
      for (const h of this.handlers) await h(e)
    }
    this.running = false
  }
}