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
import { parseDumpToPersist } from '../../../parsers/pipeline';

const HEAVY_THRESHOLD: number = 256 * 1024         // >=256KB to TaskPool
const WORKER_MAX_INPUT: number = 14 * 1024 * 1024  // 16MB

function totalSize(d: ApiDump): number {
  const a: number = d.requestBody?.length ?? 0
  const b: number = d.responseText?.length ?? 0
  return a + b
}


export async function ingestDump(dump: ApiDump, deps: PersistDeps): Promise<void> {
  const size: number = totalSize(dump)

  let events: PersistEvent[] = []

  // 过大：不进 worker, 仍然允许主线程尝试解析；
  if (size > WORKER_MAX_INPUT) {
    try {
      events = parseDumpToPersist(dump)
    } catch (e) {
      console.error('[persist] parse too large failed:', String(e))
      return
    }
  } else if (size >= HEAVY_THRESHOLD) {
    try {
      events = await taskpool.execute(
        parseDumpInWorker,
        dump.url ?? '',
        dump.requestBody ?? '',
        dump.responseText ?? ''
      ) as PersistEvent[]
    } catch (e) {
      // worker failed：backward to MainThread
      try {
        events = parseDumpToPersist(dump)
      } catch (e2) {
        console.error('[persist] parse fallback failed:', String(e2))
        return
      }
    }
  } else {
    try {
      events = parseDumpToPersist(dump)
    } catch (e) {
      console.error('[persist] parse failed:', String(e))
      return
    }
  }

  if (!events.length) return

  for (const ev of events) {
    try {
      await persistEvent(ev, deps)
    } catch (e) {
      console.error('[persist] persistEvent failed:', String(e))
    }
  }
}