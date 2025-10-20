import type { PersistDeps, PersistEvent, PersistHandler } from './type';

const REGISTRY: Map<string, PersistHandler> = new Map<string, PersistHandler>();

export function registerPersistHandler(type: string, h: PersistHandler): void {
  REGISTRY.set(type, h);
}

export function getPersistHandler(type: string): PersistHandler | undefined {
  return REGISTRY.get(type);
}

export function clearPersistHandlers(): void {
  REGISTRY.clear();
}

export function sizePersistHandlers(): number {
  return REGISTRY.size;
}

let _inited = false;
export function initPersistRegistry(): void {
  if (_inited) return;
  _inited = true;
}

export async function dispatchPersistEvent(ev: PersistEvent, deps: PersistDeps): Promise<void> {
  const handler: PersistHandler | undefined = REGISTRY.get(ev.type);
  if (handler === undefined) return;
  await handler.handle(ev, deps);
}
