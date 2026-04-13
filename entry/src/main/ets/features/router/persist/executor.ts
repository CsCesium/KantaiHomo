import { ParseResult } from "../../parsers/pipeline";
import { getHandler } from "./registry";
import { HandlerEvent, PersistDeps } from "./type";

export async function executeParseResult(
  result: ParseResult,
  deps: PersistDeps
): Promise<void> {
  // 1. 串行执行 preEvents (如 SESSION_BIND)
  for (const ev of result.preEvents) {
    await dispatchEvent(ev, deps);
  }

  // 2. 串行执行 mainEvents（同一 SQLite 连接不支持嵌套事务，不可并发）
  for (const ev of result.mainEvents) {
    await dispatchEvent(ev, deps);
  }

  // 3. 串行执行 postEvents
  if (result.postEvents) {
    for (const ev of result.postEvents) {
      await dispatchEvent(ev, deps);
    }
  }
}

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