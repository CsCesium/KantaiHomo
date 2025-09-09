import type { AnyMsg } from './types';

type Handler = (msg: AnyMsg) => void;

export class EventBus {
  private map: Map<string, Set<Handler>> = new Map<string, Set<Handler>>();

  public on(key: string, handler: Handler): () => void {
    const set: Set<Handler> = this.map.get(key) ?? new Set<Handler>();
    set.add(handler);
    this.map.set(key, set);
    return (): void => this.off(key, handler);
  }

  public off(key: string, handler: Handler): void {
    const set: Set<Handler> | undefined = this.map.get(key);
    if (set !== undefined) {
      set.delete(handler);
      if (set.size === 0) {
        this.map.delete(key);
      }
    }
  }

  public emit(key: string, msg: AnyMsg): void {
    const set: Set<Handler> | undefined = this.map.get(key);
    if (set === undefined) { return; }
    set.forEach((fn: Handler): void => {
      try { fn(msg); } catch { /* swallow */ }
    });
  }
}

export const bus: EventBus = new EventBus();