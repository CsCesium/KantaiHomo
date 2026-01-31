//src/main/ets/features/router/persist/ingest/webDump.ets
import taskpool from '@ohos.taskpool'
import { ApiDump } from "../../../../infra/web/types";
import { parseExpedition } from "../../../parsers/module/expedition";
import { persistEvent } from "./..";
import type { PersistDeps, PersistEvent } from '../type';

import '../handlers/expedition.ets';

// import '../handlers/battleResultHandler.ets';
// import '../handlers/repairHandler.ets';
import { parseDumpInWorker } from './webDumpTask'
import { parseDump, ParseResult } from '../../../parsers/pipeline';

const HEAVY_THRESHOLD: number = 256 * 1024         // >=256KB to TaskPool
const WORKER_MAX_INPUT: number = 14 * 1024 * 1024  // 16MB

function totalSize(d: ApiDump): number {
  const a: number = d.requestBody?.length ?? 0
  const b: number = d.responseText?.length ?? 0
  return a + b
}

async function executeParseResult(result: ParseResult, deps: PersistDeps): Promise<void> {
  // 1. 串行执行 preEvents
  for (const ev of result.preEvents) {
    try {
      await persistEvent(ev, deps);
    } catch (e) {
      console.error('[persist] preEvent failed:', ev.type, String(e));
    }
  }

  // 2. 并发执行 mainEvents
  if (result.mainEvents.length > 0) {
    const tasks = result.mainEvents.map(ev => persistEvent(ev, deps));
    await Promise.all(tasks);
  }

  // 3. 串行执行 postEvents
  if (result.postEvents) {
    for (const ev of result.postEvents) {
      try {
        await persistEvent(ev, deps);
      } catch (e) {
        console.error('[persist] postEvent failed:', ev.type, String(e));
      }
    }
  }
}

/**
 * 判断 ParseResult 是否为空
 */
function isEmptyResult(result: ParseResult): boolean {
  return result.preEvents.length === 0
    && result.mainEvents.length === 0
    && (!result.postEvents || result.postEvents.length === 0);
}

export async function ingestDump(dump: ApiDump, deps: PersistDeps): Promise<void> {
  const size: number = totalSize(dump)

  let result: ParseResult = { preEvents: [], mainEvents: [] };

  // 过大：不进 worker, 仍然允许主线程尝试解析；
  if (size > WORKER_MAX_INPUT) {
    try {
      result = parseDump(dump)
    } catch (e) {
      console.error('[persist] parse too large failed:', String(e))
      return
    }
  } else if (size >= HEAVY_THRESHOLD) {
    try {
      result = await taskpool.execute(
        parseDumpInWorker,
        dump.url ?? '',
        dump.requestBody ?? '',
        dump.responseText ?? ''
      ) as ParseResult
    } catch (e) {
      // worker failed：backward to MainThread
      try {
        result = parseDump(dump)
      } catch (e2) {
        console.error('[persist] parse fallback failed:', String(e2))
        return
      }
    }
  } else {
    try {
      result = parseDump(dump)
    } catch (e) {
      console.error('[persist] parse failed:', String(e))
      return
    }
  }

  if (isEmptyResult(result)) return

  await executeParseResult(result, deps);
}