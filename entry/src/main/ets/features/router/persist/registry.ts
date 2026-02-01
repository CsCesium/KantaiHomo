import { EventType } from '../../../domain/events';
import type { PersistDeps, HandlerEvent, Handler } from './type';

const handlers: Map<EventType, Handler> = new Map<EventType, Handler>();

export function registerHandler(type: EventType, handler: Handler): void {
  handlers.set(type, handler);
}

export function getHandler(eventType: EventType): Handler | undefined {
  return handlers.get(eventType);
}

export function clearHandlers(): void {
  handlers.clear();
}

export function sizeHandlers(): number {
  return handlers.size;
}

let _inited = false;
export function initHandlerRegistry(): void {
  if (_inited) return;
  _inited = true;
}

export async function dispatchEvent(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
  const handler: Handler | undefined = handlers.get(ev.type);
  if (handler === undefined) return;
  await handler.handle(ev, deps);
}
