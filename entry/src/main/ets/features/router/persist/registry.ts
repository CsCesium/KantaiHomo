import { EventType } from '../../../domain/events';
import type { PersistDeps, HandlerEvent, Handler } from './type';

// trigger side-effect handler registrations
import '../handlers/session';
import '../handlers/port';
import '../handlers/expedition';
import '../handlers/battle';
import '../handlers/sortie';

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

