import { ApiDump } from "../../infra/web/types"
import { PersistEvent } from "../router/persist/type"

export interface ParseResult {
  /** 必须先执行 */
  preEvents: PersistEvent[];
  /** 可并发 */
  mainEvents: PersistEvent[];
  /** 最后串行 (可选) */
  postEvents?: PersistEvent[];
}

export interface DumpPipeline {
  name: string;
  match: (url: string) => boolean;
  parse: (dump: ApiDump) => ParseResult | null;
}


//General function
export const DUMP_PIPELINES: DumpPipeline[] = [];

export function registerPipeline(pipeline: DumpPipeline): void {
  DUMP_PIPELINES.push(pipeline);
}

export function parseDump(dump: ApiDump): ParseResult {
  const url = dump.url;
  const merged: ParseResult = {
    preEvents: [],
    mainEvents: [],
    postEvents: [],
  };

  for (const p of DUMP_PIPELINES) {
    if (p.match(url)) {
      const result = p.parse(dump);
      if (result) {
        merged.preEvents.push(...result.preEvents);
        merged.mainEvents.push(...result.mainEvents);
        if (result.postEvents) {
          merged.postEvents!.push(...result.postEvents);
        }
      }
    }
  }
  return merged;
}