import {
  ExpeditionCatalogEvent,
  ExpeditionResultEvent, ExpeditionStartEvent, ExpeditionUpdateEvent } from "../../../domain/events"
import { ApiDump } from "../../../infra/web/types"
import { PersistEvent } from "../../router/persist/type"
import { parseExpedition } from "../module/expedition"

export interface DumpPipeline {
  name: string
  match: (url: string) => boolean
  parse: (dump: ApiDump) => PersistEvent[]
}

// Expedition ------------------------------------------------------
type AnyExpEvt =
  | ExpeditionStartEvent
  | ExpeditionUpdateEvent
  | ExpeditionResultEvent
  | ExpeditionCatalogEvent

function toPersistFromExpedition(e: AnyExpEvt): PersistEvent | null {
  // payload.kind decided by start/slotState/result/catalog
  if (e.type === 'EXPEDITION_START') {
    return {
      id: e.id,
      type: 'EXPEDITION',
      timestamp: e.timestamp,
      source: e.source,
      endpoint: e.endpoint,
      schemaVersion: e.schemaVersion,
      payload: { kind: 'start', data: e.payload }
    } as PersistEvent
  }

  if (e.type === 'EXPEDITION_UPDATE') {
    return {
      id: e.id,
      type: 'EXPEDITION',
      timestamp: e.timestamp,
      source: e.source,
      endpoint: e.endpoint,
      schemaVersion: e.schemaVersion,
      payload: { kind: 'slotState', data: e.payload }
    } as PersistEvent
  }

  if (e.type === 'EXPEDITION_RESULT') {
    return {
      id: e.id,
      type: 'EXPEDITION',
      timestamp: e.timestamp,
      source: e.source,
      endpoint: e.endpoint,
      schemaVersion: e.schemaVersion,
      payload: { kind: 'result', data: e.payload }
    } as PersistEvent
  }

  if (e.type === 'EXPEDITION_CATALOG') {
    return {
      id: e.id,
      type: 'EXPEDITION',
      timestamp: e.timestamp,
      source: e.source,
      endpoint: e.endpoint,
      schemaVersion: e.schemaVersion,
      payload: { kind: 'catalog', data: e.payload }
    } as PersistEvent
  }

  return null
}

const expeditionPipeline: DumpPipeline = {
  name: 'expedition',
  match: (url: string) => {
    // fast match
    return url.indexOf('/api_req_mission/') >= 0
      || url.indexOf('/api_get_member/deck') >= 0
      || url.indexOf('/api_port/port') >= 0
      || url.indexOf('/api_start2') >= 0
  },
  parse: (dump: ApiDump) => {
    const evts = parseExpedition(dump) ?? []
    if (!evts.length) return []

    const out: PersistEvent[] = []
    for (const e of evts as AnyExpEvt[]) {
      const pe = toPersistFromExpedition(e)
      if (pe != null) out.push(pe)
    }
    return out
  }
}
//TODO: OTHER PIPELINE,e.g.
// const battlePipeline: DumpPipeline = { ... }
// const repairPipeline: DumpPipeline = { ... }

//General function
export const DUMP_PIPELINES: DumpPipeline[] = [
  expeditionPipeline
  // battlePipeline,
  // repairPipeline,
]

export function parseDumpToPersist(dump: ApiDump): PersistEvent[] {
  const url: string = dump.url ?? ''
  for (const p of DUMP_PIPELINES) {
    if (p.match(url)) {
      return p.parse(dump)
    }
  }
  return []
}
