import type { ApiDump } from "../../../infra/web/types"
import type { HandlerEvent } from "../../router/persist/type"
import { parseRanking } from "../module/ranking"
import { DumpPipeline, ParseResult, registerPipeline } from "../pipeline"

export const rankingPipeline: DumpPipeline = {
  name: 'ranking',
  match: (url) => url.includes('/api_req_ranking/'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseRanking(dump)
    if (!evts?.length) return null

    const mainEvents: HandlerEvent[] = evts as HandlerEvent[]
    return { preEvents: [], mainEvents }
  }
}

registerPipeline(rankingPipeline)
