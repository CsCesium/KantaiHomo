//src/main/ets/features/router/persist/ingest/webDump.ets
import taskpool from '@ohos.taskpool'
import { ApiDump } from "../../../../infra/web/types";
import '../../../parsers/pipelines'; // trigger side-effect pipeline registrations
// trigger side-effect handler registrations (must come after executor/registry are loaded)
import '../../handlers/session';
import '../../handlers/port';
import '../../handlers/expedition';
import '../../handlers/quest';
import '../../handlers/start2';
import '../../handlers/battle';
import '../../handlers/sortie';
import '../../handlers/ranking';
import '../../handlers/mapinfo';
import '../../handlers/supply';
import '../../handlers/lbas';
import type { PersistDeps } from '../type';
import { parseDumpInWorker } from './webDumpTask'
import { parseDump, ParseResult } from '../../../parsers/pipeline';
import { dispatchEvent } from '../executor';
import { parseSvdata, parseSvdataAndUnwrap } from '../../../utils/common';
import { ApiStateFields, detectStateFields } from '../../../../domain/models/api/response';
import { extractAndUpdateState } from '../../../state';

const HEAVY_THRESHOLD: number = 256 * 1024         // >=256KB to TaskPool
const WORKER_MAX_INPUT: number = 14 * 1024 * 1024  // 16MB

function totalSize(d: ApiDump): number {
  const a: number = d.requestBody?.length ?? 0
  const b: number = d.responseText?.length ?? 0
  return a + b
}

async function executeParseResult(result: ParseResult, deps: PersistDeps): Promise<void> {
  // 1. 串行执行 preEvents（如 SESSION_BIND 会切换 DB，必须先完成）
  for (const ev of result.preEvents) {
    try {
      await dispatchEvent(ev, deps);
    } catch (e) {
      console.error('[persist] preEvent failed:', ev.type, String(e));
    }
  }

  // 2. 串行执行 mainEvents
  // 注意：不能并发执行——多个 handler 同时调用 withTransaction 会在同一个
  // SQLite 连接上并发调用 beginTransaction()，SQLite 不支持嵌套事务，
  // 除第一个外所有事务都会抛出异常，导致数据写入静默失败。
  for (const ev of result.mainEvents) {
    try {
      await dispatchEvent(ev, deps);
    } catch (e) {
      console.error('[persist] mainEvent failed:', ev.type, String(e));
    }
  }

  // 3. 串行执行 postEvents
  if (result.postEvents) {
    for (const ev of result.postEvents) {
      try {
        await dispatchEvent(ev, deps);
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
  // 提取状态（补给 API 的 api_material 为 number[] 格式，由专用 pipeline 处理，跳过通用提取）
  const isCharge = dump.url?.includes('/api_req_hokyu/charge');
  if (!isCharge) {
    try {
      const apiData = parseSvdataAndUnwrap<ApiStateFields>(dump.responseText);
      if(apiData) {
        const fields = detectStateFields(apiData);
        if(fields.any){
          const isPort = dump.url?.includes('./api_port/port');
          extractAndUpdateState(apiData,{batchUpdate: isPort});
        }
      }
    } catch (e) {
      console.debug('[ingest] state extract skipped:', String(e));
    }
  }

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
