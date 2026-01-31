import type { EventType } from '../../../domain/events';
import type { PersistDeps, HandlerEvent, Handler } from './type';

const registry: Map<EventType, Handler> = new Map<EventType, Handler>();

export function registerPersistHandler(type: EventType, handler: Handler): void {
  registry.set(type, handler);
}

export async function persistEvent(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
  if (ev == null || ev.id == null || ev.type == null) return;

  if (deps.recentIdCache && deps.recentIdCache.has(ev.id)) return;

  const h: Handler | undefined = registry.get(ev.type);
  if (h == null) return;

  try {
    await h.handle(ev, deps);
    if (deps.recentIdCache) deps.recentIdCache.add(ev.id);
  } catch (e) {
    console.error('[persist] failed', ev.type, ev.id, e);
  }
}
