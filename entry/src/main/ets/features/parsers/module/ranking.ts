import { AnyRankingEvt, RankingEntryList } from "../../../domain/events/ranking"
import { JsonArray, JsonObject, asArray, asObject, getNum, getStr } from "../../../domain/models/json"
import { ApiDump } from "../../../infra/web/types"
import { parseSvdata } from "../../utils/common"
import { ParserCtx, mkEvt, detectEndpoint, EndpointRule } from "./common"

// Match the logical prefix only — the suffix is obfuscated and changes between game updates.
const RULES: EndpointRule[] = [
  {
    endpoint: '/api_req_ranking',
    match: (url: string) => url.indexOf('/api_req_ranking/') >= 0,
  },
]

// Confirmed field mapping (RecordRankingModel.SetAll, current client):
//   api_mxltvkpyuklh  → rank
//   api_mtjmdcwtvhdr  → nickname
//   api_itbrdpdbkynm  → comment
//   api_pbgkfylkbjuy  → flagtype
//   api_pcumlrymlujh  → classrank (admiral rank tier)
//   api_itslcqtmrxtf  → medals  (NOT period exp — do not divide by 1428)
//   api_wuhnhojjxmke  → score[0] (lifetime/cumulative exp, ~hundreds of millions)
//   api_xlqcmisdyfiu  → score[1] (monthly ranking senka, direct integer value)
//   api_mcouotbbbzpx  → score[2] (secondary score component)
const KNOWN_RANK     = 'api_mxltvkpyuklh'
const KNOWN_NICKNAME = 'api_mtjmdcwtvhdr'
// score[1] is the monthly senka as displayed in the ranking — stored directly, no conversion.
const KNOWN_SENKA    = 'api_xlqcmisdyfiu'
// score[2]: secondary component (e.g. base senka without EO bonus), used as fallback.
const KNOWN_SENKA_2  = 'api_mcouotbbbzpx'

// Legacy unobfuscated endpoint field names.
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
 * Parse a ranking list entry.
 *
 * Priority:
 *   ① Current obfuscated field names (precise, fast)
 *   ② Legacy unobfuscated field names
 *   ③ Value-range heuristics (obfuscation-agnostic fallback)
 *
 * Value tiers (stable across obfuscation changes):
 *   > 100 000 000 : lifetime cumulative exp (score[0]) — excluded
 *   1 000 000 – 100 000 000 : medals / long-term accumulators — excluded
 *   1 000 – 1 000 000 : monthly ranking senka (e.g. 1654)
 *   1 – 1 000 : rank position (1–1000) and admiral-rank tier (1–~20)
 *   0 : flag fields
 */
function parseEntry(entry: JsonObject): EntryFields | null {
  // ① Current obfuscated field names
  const rank1     = getNum(entry, KNOWN_RANK, 0)
  const nickname1 = getStr(entry, KNOWN_NICKNAME, '')
  // Prefer score[1]; fall back to score[2] if score[1] is absent.
  const senka1 = getNum(entry, KNOWN_SENKA, 0) || getNum(entry, KNOWN_SENKA_2, 0)
  if (rank1 > 0 && nickname1) {
    return { rank: rank1, nickname: nickname1, memberId: '', senka: senka1 }
  }

  // ② Legacy unobfuscated field names
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

  // ③ Heuristic fallback using value tiers
  const strings: string[] = []
  const nums: number[]    = []
  const vals = Object.values(entry) as (string | number | boolean | null | JsonObject | JsonArray)[]
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    if (typeof v === 'string') strings.push(v)
    else if (typeof v === 'number') nums.push(v)
  }
  if (strings.length < 1 || nums.length < 3) return null

  // Nickname = shortest non-empty string (KanColle nickname cap: 7 chars)
  const nonEmpty = strings.filter(s => s.length > 0)
  if (nonEmpty.length === 0) return null
  const nickname3 = nonEmpty.reduce((a, b) => (a.length <= b.length ? a : b))

  // Monthly senka = largest integer in [1 000, 1 000 000)
  // (lifetime exp > 100M and medals > 1M are above this window; rank ≤ 1000 is below)
  let senka3 = -1
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i]
    if (v >= 1000 && v < 1_000_000 && v > senka3) senka3 = v
  }
  if (senka3 < 0) return null

  // Rank = largest integer in [1, 1000] (top-1000 ranking; admiral-rank tier ≤ ~20 is smaller)
  let rank3 = -1
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i]
    if (v >= 1 && v <= 1000 && v > rank3) rank3 = v
  }
  if (rank3 <= 0) return null

  return { rank: rank3, nickname: nickname3, memberId: '', senka: senka3 }
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
