import type {EventType} from '../../../domain/events';
import type { PersistDeps, PersistEvent, PersistHandler, RecentIdCache }from './type'

const registry: Map<EventType, PersistHandler> = new Map<EventType, PersistHandler>();

export function registerPersistHandler(type: EventType, handler: PersistHandler): void {
  registry.set(type, handler);
}

/** —— 入口：单事件持久化 —— */
export async function persistEvent(ev: PersistEvent, deps: PersistDeps): Promise<void> {
  if (ev == null) return;
  if (ev.id == null || ev.type == null) return;

  if (deps.recentIdCache && deps.recentIdCache.has(ev.id)) return;

  const handler: PersistHandler | undefined = registry.get(ev.type);
  if (handler == null) return;

  try {
    await handler.invoke(ev, deps);
    if (deps.recentIdCache) deps.recentIdCache.add(ev.id);
  } catch (e) {
    console.error('[persist] failed', ev.type, ev.id, e);
  }
}
