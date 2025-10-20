import type { EventType } from '../../../domain/events';
import type { PersistDeps, PersistEvent, PersistHandler } from './type';

const registry: Map<EventType, PersistHandler> = new Map<EventType, PersistHandler>();

export function registerPersistHandler(type: EventType, handler: PersistHandler): void {
  registry.set(type, handler);
}

export async function persistEvent(ev: PersistEvent, deps: PersistDeps): Promise<void> {
  if (ev == null || ev.id == null || ev.type == null) return;

  if (deps.recentIdCache && deps.recentIdCache.has(ev.id)) return;

  const h: PersistHandler | undefined = registry.get(ev.type);
  if (h == null) return;

  try {
    await h.handle(ev, deps);
    if (deps.recentIdCache) deps.recentIdCache.add(ev.id);
  } catch (e) {
    console.error('[persist] failed', ev.type, ev.id, e);
  }
}
