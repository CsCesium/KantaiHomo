type Unsub = () => void;
type Handler<T> = (msg: T) => void;

export class EventBus {
  private map = new Map<string, Set<Function>>();

  on<T>(key: string, handler: Handler<T>): Unsub {
    if (!this.map.has(key)) this.map.set(key, new Set());
    this.map.get(key)!.add(handler as any);
    return () => this.off(key, handler);
  }

  off<T>(key: string, handler: Handler<T>) {
    this.map.get(key)?.delete(handler as any);
  }

  emit<T>(key: string, msg: T) {
    this.map.get(key)?.forEach(fn => {
      try { (fn as Handler<T>)(msg); } catch (e) { console.error(e); }
    });
  }
}

export const bus = new EventBus();