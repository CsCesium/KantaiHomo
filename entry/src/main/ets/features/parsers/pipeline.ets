import { ApiDump } from "../../infra/web/types"
import { PersistEvent } from "../router/persist/type"
import { expeditionPipeline } from "./pipelines/expedition"

export interface DumpPipeline {
  name: string
  match: (url: string) => boolean
  parse: (dump: ApiDump) => PersistEvent[]
}

//General function
export const DUMP_PIPELINES: DumpPipeline[] = [
  //portPipeline,
  expeditionPipeline
  // battlePipeline,
  // repairPipeline,
]

export function parseDumpToPersist(dump: ApiDump): PersistEvent[] {
  const url = dump.url;
  const out: PersistEvent[] = [];
  for (const p of DUMP_PIPELINES) {
    if (p.match(url)) out.push(...p.parse(dump));
  }
  return out;
}