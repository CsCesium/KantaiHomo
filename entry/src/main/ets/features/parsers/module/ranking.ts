import { AnyRankingEvt, RankingEntryList } from "../../../domain/events/ranking"
import { JsonArray, JsonObject, asArray, asObject, getNum, getStr } from "../../../domain/models/json"
import { ApiDump } from "../../../infra/web/types"
import { parseSvdata } from "../../utils/common"
import { ParserCtx, mkEvt, detectEndpoint, EndpointRule } from "./common"

// Match the logical prefix only — the suffix is obfuscated and changes between game updates.
const RULES: EndpointRule[] = [
  {
    endpoint: '/api_req_ranking',
    match: (url: string) => {
      const i = url.indexOf('/api_req_ranking/')
      return i >= 0
    },
  },
]

// Known field names for the current game client (obfuscated).
// These are tried first; if they yield nothing, heuristic detection takes over.
const KNOWN_RANK     = 'api_mxltvkpyuklh'
const KNOWN_NICKNAME = 'api_mtjmdcwtvhdr'
const KNOWN_SCORE    = 'api_itslcqtmrxtf'

// Field names from the legacy unobfuscated endpoint.
const LEGACY_RANK      = 'api_no'
const LEGACY_NICKNAME  = 'api_nickname'
const LEGACY_SENKA     = 'api_rate'
const LEGACY_MEMBER_ID = 'api_member_id'

interface EntryFields {
  rank: number
  nickname: string
  memberId: string
  senka: number
}

/**
 * Parse a ranking list entry using known field names first, then fall back to
 * value-range heuristics so the parser survives future obfuscation changes.
 *
 * Value-range assumptions (stable across obfuscation):
 *   - rank:         integer 1–5000 (top-1000 ranking)
 *   - period score: integer 10 000 – 100 000 000 (monthly exp for ranked players)
 *   - total exp:    integer > 100 000 000 (cumulative, excluded from period score)
 *   - nickname:     shortest non-empty string (KanColle nickname ≤ 7 chars)
 */
function parseEntry(entry: JsonObject): EntryFields | null {
  // ① Try current obfuscated field names
  const rank1     = getNum(entry, KNOWN_RANK, 0)
  const nickname1 = getStr(entry, KNOWN_NICKNAME, '')
  const score1    = getNum(entry, KNOWN_SCORE, 0)
  if (rank1 > 0 && nickname1) {
    return { rank: rank1, nickname: nickname1, memberId: '', senka: Math.floor(score1 / 1428) }
  }

  // ② Try legacy unobfuscated field names
  const rank2     = getNum(entry, LEGACY_RANK, 0)
  const nickname2 = getStr(entry, LEGACY_NICKNAME, '')
  const senka2    = getNum(entry, LEGACY_SENKA, 0)
  if (rank2 > 0 && nickname2) {
    return {
      rank: rank2,
      nickname: nickname2,
      memberId: getStr(entry, LEGACY_MEMBER_ID, ''),
      senka: senka2,
    }
  }

  // ③ Heuristic fallback: infer fields from value ranges
  const strings: string[] = []
  const nums: number[]    = []
  const vals = Object.values(entry) as (string | number | boolean | null | JsonObject | JsonArray)[]
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    if (typeof v === 'string') strings.push(v)
    else if (typeof v === 'number') nums.push(v)
  }
  if (strings.length < 1 || nums.length < 3) return null

  // Nickname = shortest non-empty string (nicknames are max 7 chars in KanColle)
  const nonEmpty = strings.filter(s => s.length > 0)
  if (nonEmpty.length === 0) return null
  const nickname3 = nonEmpty.reduce((a, b) => (a.length <= b.length ? a : b))

  // Period score = largest integer in [10 000, 100 000 000)
  let periodScore = -1
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i]
    if (v > 10_000 && v < 100_000_000 && v > periodScore) periodScore = v
  }
  if (periodScore < 0) return null

  // Rank = largest integer in [1, 5000] (top-1000 pages; admiral-rank ≤ ~20 will be smaller)
  let rank3 = -1
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i]
    if (v >= 1 && v <= 5000 && v > rank3) rank3 = v
  }
  if (rank3 <= 0) return null

  return { rank: rank3, nickname: nickname3, memberId: '', senka: Math.floor(periodScore / 1428) }
}

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
    const parsed = parseEntry(entry)
    if (parsed && parsed.rank > 0 && parsed.nickname) {
      entries.push(parsed)
    }
  }

  if (entries.length === 0) return []

  const payload: RankingEntryList = { entries }
  return [mkEvt(ctx, 'RANKING_SNAPSHOT', ['RANKING_SNAPSHOT', ctx.ts], payload)]
}
