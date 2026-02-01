import type { EventType } from '../../../domain/events';
import type { PersistDeps, Handler } from './type';
import { ApiDump } from '../../../infra/web/types';
import { DUMP_PIPELINES } from '../../parsers/pipeline';
import { executeParseResult } from './executor';
import '../../parsers/pipelines';




/**
 * 处理 API Dump
 * 匹配 Pipeline → 解析 → 执行
 */
export async function processDump(dump: ApiDump, deps: PersistDeps): Promise<void> {
  for (const pipeline of DUMP_PIPELINES) {
    if (pipeline.match(dump.url)) {
      const result = pipeline.parse(dump);
      if (result) {
        await executeParseResult(result, deps);
      }
    }
  }
}

// Re-export types
export type { PersistDeps, HandlerEvent, Handler } from './type';