import { AnyRankingEvt, RankingEntryList } from "../../../domain/events/ranking"
import { JsonArray, JsonObject, asArray, asObject, getNum, getStr } from "../../../domain/models/json"
import { ApiDump } from "../../../infra/web/types"
import { parseSvdata } from "../../utils/common"
import { ParserCtx, mkEvt, detectEndpoint, EndpointRule } from "./common"

const RULES: EndpointRule[] = [
  {
    endpoint: '/api_req_ranking/getlist',
    match: (url: string) => url.includes('/api_req_ranking/getlist'),
  },
]

export function parseRanking(dump: ApiDump): AnyRankingEvt[] {
  const endpoint = detectEndpoint(dump.url, RULES)
  if (!endpoint) return []

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  }

  const root: JsonObject | null = parseSvdata<JsonObject>(ctx.responseText)
  if (!root) return []

  const apiData = root['api_data']
  const dataObj: JsonObject | null = asObject(apiData as JsonObject)
  if (!dataObj) return []

  const rawList = dataObj['api_list']
  const list: JsonArray | null = asArray(rawList as JsonArray)
  if (!list || list.length === 0) return []

  const entries: RankingEntryList['entries'] = []
  for (const item of list) {
    const entry: JsonObject | null = asObject(item as JsonObject)
    if (!entry) continue
    entries.push({
      memberId: getStr(entry, 'api_member_id', ''),
      rank: getNum(entry, 'api_no', 0),
      senka: getNum(entry, 'api_rate', 0),
      nickname: getStr(entry, 'api_nickname', ''),
    })
  }

  if (entries.length === 0) return []

  const payload: RankingEntryList = { entries }
  return [mkEvt(ctx, 'RANKING_SNAPSHOT', ['RANKING_SNAPSHOT', ctx.ts], payload)]
}
