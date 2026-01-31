import type { PersistDeps, HandlerEvent, Handler } from './type';

const REGISTRY: Map<string, Handler> = new Map<string, Handler>();

export function registerHandler(type: string, h: Handler): void {
  REGISTRY.set(type, h);
}

export function getHandler(type: string): Handler | undefined {
  return REGISTRY.get(type);
}

export function clearHandlers(): void {
  REGISTRY.clear();
}

export function sizeHandlers(): number {
  return REGISTRY.size;
}

let _inited = false;
export function initHandlerRegistry(): void {
  if (_inited) return;
  _inited = true;
}

export async function dispatchEvent(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
  const handler: Handler | undefined = REGISTRY.get(ev.type);
  if (handler === undefined) return;
  await handler.handle(ev, deps);
}
