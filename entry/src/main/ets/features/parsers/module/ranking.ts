import { AnyRankingEvt, RankingEntryList } from "../../../domain/events/ranking"
import { JsonArray, JsonObject, asArray, asObject, getNum, getStr } from "../../../domain/models/json"
import { ApiDump } from "../../../infra/web/types"
import { parseSvdata } from "../../utils/common"
import { ParserCtx, mkEvt, detectEndpoint, EndpointRule } from "./common"
import { getAdmiral } from "../../state"

// Match the logical prefix — the suffix is obfuscated and changes between game updates.
const RULES: EndpointRule[] = [
  {
    endpoint: '/api_req_ranking',
    match: (url: string) => url.indexOf('/api_req_ranking/') >= 0,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Decoding constants from game source (TaskTop.__drawRanking).
//
// PORT_API_SEED  — consts.PORT_API_SEED, changes with each client release.
//                  Update this array when the game ships a new client bundle.
// RANK_SEED      — inline array in __drawRanking, stable across releases.
// ─────────────────────────────────────────────────────────────────────────────
const PORT_API_SEED = [3676, 3331, 2169, 4479, 8306, 4265, 4207, 2470, 9987, 2953]
const RANK_SEED     = [8931, 1201, 1156, 5061, 4569, 4732, 3779, 4568, 5695, 4619, 4912, 5669, 6586]

// Confirmed obfuscated field names from RecordRankingModel.SetAll (current client):
//   api_mxltvkpyuklh  → rank
//   api_mtjmdcwtvhdr  → nickname
//   api_wuhnhojjxmke  → score[0]  (encoded; decode with formula below)
//   api_itslcqtmrxtf  → medals    (not used for senka)
const KNOWN_RANK     = 'api_mxltvkpyuklh'
const KNOWN_NICKNAME = 'api_mtjmdcwtvhdr'
const KNOWN_SCORE0   = 'api_wuhnhojjxmke'

// Legacy unobfuscated endpoint field names.
const LEGACY_RANK      = 'api_no'
const LEGACY_NICKNAME  = 'api_nickname'
const LEGACY_SENKA     = 'api_rate'
const LEGACY_MEMBER_ID = 'api_member_id'

/**
 * Replicates TaskTop._getPortSeed:
 *   sd = PORT_API_SEED[memberId % 10]
 *   return (sd - sd%100) / 100   ← floor(sd / 100)
 */
function getPortSeed(memberId: number): number {
  const sd = PORT_API_SEED[memberId % 10]
  return (sd - (sd % 100)) / 100
}

/**
 * Replicates TaskTop.__drawRanking score decode:
 *   score = (score[0] / RANK_SEED[rank%13] / portSd) - 91
 *
 * The server encodes as (senka+91)*hashValue*portSd, so this inverts it.
 * portSd depends on the VIEWER's memberId, not the ranked player's.
 */
function decodeScore(score0: number, rank: number, memberId: number): number {
  if (score0 <= 0 || rank <= 0 || memberId <= 0) return 0
  const hashValue = RANK_SEED[rank % 13]
  const portSd    = getPortSeed(memberId)
  if (portSd <= 0) return 0
  return Math.round(score0 / hashValue / portSd) - 91
}

interface EntryFields {
  rank: number
  nickname: string
  memberId: string
  senka: number
}

function parseEntry(entry: JsonObject, myMemberId: number): EntryFields | null {
  // ① Current obfuscated field names (fast path)
  const rank1     = getNum(entry, KNOWN_RANK, 0)
  const nickname1 = getStr(entry, KNOWN_NICKNAME, '')
  const score0    = getNum(entry, KNOWN_SCORE0, 0)
  if (rank1 > 0 && nickname1) {
    const senka = decodeScore(score0, rank1, myMemberId)
    return { rank: rank1, nickname: nickname1, memberId: '', senka: Math.max(0, senka) }
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

  // ③ Heuristic fallback — value-tier detection, no hardcoded field names
  //
  // Tier layout (stable across obfuscation changes):
  //   > 30 000 000  : score[0] — encoding yields (senka+91)*hashValue*portSd ≈ 30M–500M
  //   1 – 1 000     : rank position (1–1000) and admiral-rank tier (1–~20)
  //   0             : flag fields
  //   strings       : nickname (shorter) and comment (longer)
  const strings: string[] = []
  const nums: number[]    = []
  const vals = Object.values(entry) as (string | number | boolean | null | JsonObject | JsonArray)[]
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    if (typeof v === 'string') strings.push(v)
    else if (typeof v === 'number') nums.push(v)
  }
  if (strings.length < 1 || nums.length < 3) return null

  const nonEmpty = strings.filter(s => s.length > 0)
  if (nonEmpty.length === 0) return null
  const nickname3 = nonEmpty.reduce((a, b) => (a.length <= b.length ? a : b))

  // score[0]: largest number > 30 000 000
  let score0h = -1
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] > 30_000_000 && nums[i] > score0h) score0h = nums[i]
  }

  // rank: largest number in [1, 1000]
  let rank3 = -1
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] >= 1 && nums[i] <= 1000 && nums[i] > rank3) rank3 = nums[i]
  }
  if (rank3 <= 0) return null

  const senka3 = score0h > 0 ? Math.max(0, decodeScore(score0h, rank3, myMemberId)) : 0
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

  const myMemberId = getAdmiral()?.memberId ?? 0

  const entries: RankingEntryList['entries'] = []
  for (const item of list) {
    const entry: JsonObject | null = asObject(item as JsonObject)
    if (!entry) continue
    const parsed = parseEntry(entry, myMemberId)
    if (parsed && parsed.rank > 0 && parsed.nickname) {
      entries.push(parsed)
    }
  }

  if (entries.length === 0) return []

  const payload: RankingEntryList = { entries }
  return [mkEvt(ctx, 'RANKING_SNAPSHOT', ['RANKING_SNAPSHOT', ctx.ts], payload)]
}
