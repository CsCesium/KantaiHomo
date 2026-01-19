//entry/src/main/ets/features/parsers/expedition.ts
import type { ApiDump } from '../../../infra/web/types';
import { parseSvdata, parseFormBody, makeEventId} from "../utils/common"

import type {
  ExpeditionStartEvent,
  ExpeditionUpdateEvent,
  ExpeditionResultEvent,
  ExpeditionCatalogEvent,
  AnyExpEvt
} from '../../../domain/events/expedition'
import {
  ApiMissionStartRespRaw,
  normalizeMissionStart,
  ApiMissionResultRespRaw,
  normalizeMissionResult,
  ApiDeckMissionTuple,
  normalizeDeckMission,
  normalizeMissionCatalog
} from '../../../domain/models';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';


const RULES: EndpointRule[] = [
  { endpoint: '/api_req_mission/start', match: (url: string) => url.includes('/api_req_mission/start') },
  { endpoint: '/api_req_mission/result', match: (url: string) => url.includes('/api_req_mission/result') },
  { endpoint: '/api_get_member/deck', match: (url: string) => url.includes('/api_get_member/deck') },
  { endpoint: '/api_start2', match: (url: string) => url.includes('/api_start2') },
]

function parseStart(ctx: ParserCtx): ExpeditionStartEvent[] | null {
  const params = parseFormBody(ctx.requestBody)
  const deckId = Number(params.get('api_deck_id') ?? 0)
  const missionId = Number(params.get('api_mission_id') ?? 0)

  const js = parseSvdata<any>(ctx.responseText)
  const raw = js?.api_data as ApiMissionStartRespRaw | undefined
  if (!raw) return null

  const payload = normalizeMissionStart(deckId, missionId, raw)
  const evt = mkEvt(ctx, 'EXPEDITION_START', ['ex-start', deckId, missionId, payload.complTime], payload) as ExpeditionStartEvent
  return [evt]
}

function parseResult(ctx: ParserCtx): ExpeditionResultEvent[] | null {
  const params = parseFormBody(ctx.requestBody)
  const deckId = Number(params.get('api_deck_id') ?? 0)
  const missionId = Number(params.get('api_mission_id') ?? 0)

  const js = parseSvdata<any>(ctx.responseText)
  const raw = js?.api_data as ApiMissionResultRespRaw | undefined
  if (!raw) return null

  const payload = normalizeMissionResult(deckId, missionId, raw)
  const evt = mkEvt(ctx, 'EXPEDITION_RESULT', ['ex-result', deckId, missionId, payload.finishedAt], payload) as ExpeditionResultEvent
  return [evt]
}

function parseDeckState(ctx: ParserCtx): ExpeditionUpdateEvent[] | null {
  const js = parseSvdata<any>(ctx.responseText)
  const data = js?.api_data
  const decks = data?.api_deck ?? data?.api_deck_port
  if (!Array.isArray(decks)) return null

  const states = decks.map((d: any, idx: number) => {
    const deckId = d.api_id ?? (idx + 1)
    const tuple = d.api_mission as ApiDeckMissionTuple
    return normalizeDeckMission(deckId, tuple)
  })

  const evt = mkEvt(ctx, 'EXPEDITION_UPDATE', ['ex-update', ctx.ts], states) as ExpeditionUpdateEvent
  return [evt]
}

function parseCatalog(ctx: ParserCtx): ExpeditionCatalogEvent[] | null {
  const js = parseSvdata<any>(ctx.responseText)
  const arr = js?.api_data?.api_mst_mission as any[]
  if (!Array.isArray(arr)) return null

  const list = arr.map(normalizeMissionCatalog)
  const evt = mkEvt(ctx, 'EXPEDITION_CATALOG', ['ex-catalog', list.length, ctx.ts], list) as ExpeditionCatalogEvent
  return [evt]
}

export function parseExpedition(dump: ApiDump): AnyExpEvt[] | null {
  const endpoint = detectEndpoint(dump.url, RULES)
  if (!endpoint) return null

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  }

  if (endpoint === '/api_req_mission/start') return parseStart(ctx)
  if (endpoint === '/api_req_mission/result') return parseResult(ctx)
  if (endpoint === '/api_get_member/deck') return parseDeckState(ctx)
  if (endpoint === '/api_start2') return parseCatalog(ctx)

  return null
}