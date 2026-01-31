import type { PersistDeps, HandlerEvent, Handler } from './type';

const REGISTRY: Map<string, Handler> = new Map<string, Handler>();

export function registerPersistHandler(type: string, h: Handler): void {
  REGISTRY.set(type, h);
}

export function getPersistHandler(type: string): Handler | undefined {
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

export async function dispatchPersistEvent(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
  const handler: Handler | undefined = REGISTRY.get(ev.type);
  if (handler === undefined) return;
  await handler.handle(ev, deps);
}
