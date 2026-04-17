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
  {
    // Obfuscated ranking endpoint used by current game client
    endpoint: '/api_req_ranking/mxltvkpyuklh',
    match: (url: string) => url.includes('/api_req_ranking/mxltvkpyuklh'),
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

  if (endpoint === '/api_req_ranking/mxltvkpyuklh') {
    // Obfuscated API: field names differ from the old unobfuscated endpoint.
    // api_itslcqtmrxtf is the period score; senka ≈ floor(score / 1428).
    for (const item of list) {
      const entry: JsonObject | null = asObject(item as JsonObject)
      if (!entry) continue
      const periodScore = getNum(entry, 'api_itslcqtmrxtf', 0)
      entries.push({
        memberId: '',
        rank: getNum(entry, 'api_mxltvkpyuklh', 0),
        senka: Math.floor(periodScore / 1428),
        nickname: getStr(entry, 'api_mtjmdcwtvhdr', ''),
      })
    }
  } else {
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
  }

  if (entries.length === 0) return []

  const payload: RankingEntryList = { entries }
  return [mkEvt(ctx, 'RANKING_SNAPSHOT', ['RANKING_SNAPSHOT', ctx.ts], payload)]
}
