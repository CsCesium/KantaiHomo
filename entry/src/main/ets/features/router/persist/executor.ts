import { getHandler } from "./registry";
import { HandlerEvent, PersistDeps } from "./type";

export async function dispatchEvent(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
  const handler = getHandler(ev.type);
  if (handler) {
    try {
      await handler.handle(ev, deps);
    } catch (e) {
      console.error(`[persist] handler error for ${ev.type}:`, e);
    }
  } else {
    console.warn(`[persist] no handler for event type: ${ev.type}`);
  }
}
