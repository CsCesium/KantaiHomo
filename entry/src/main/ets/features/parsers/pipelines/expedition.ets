import { ExpeditionStartEvent, ExpeditionUpdateEvent, ExpeditionResultEvent,
  AnyExpEvt } from '../../../domain/events'
import { ApiDump } from '../../../infra/web/types'
import { HandlerEvent, PersistEventExpedition } from '../../router/persist/type'
import { parseExpedition } from '../module'
import { DumpPipeline } from '../pipeline'

function toPersistFromExpedition(e: AnyExpEvt): PersistEventExpedition | null {
  if (e.type === 'EXPEDITION_START') {
    return {
      id: e.id,
      type: 'EXPEDITION',
      timestamp: e.timestamp,
      source: e.source,
      endpoint: e.endpoint,
      schemaVersion: e.schemaVersion,
      payload: { kind: 'start', data: e.payload }
    } as PersistEventExpedition
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
    } as PersistEventExpedition
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
    } as PersistEventExpedition
  }

  return null
}

export const expeditionPipeline: DumpPipeline = {
  name: 'expedition',
  match: (url: string) => {
    return url.indexOf('/api_req_mission/') >= 0
      || url.indexOf('/api_get_member/deck') >= 0
  },
  parse: (dump: ApiDump) => {
    const evts = parseExpedition(dump) ?? []
    if (!evts.length) return []

    const out: HandlerEvent[] = []
    for (const e of evts as AnyExpEvt[]) {
      if (e.type !== 'EXPEDITION_START' && e.type !== 'EXPEDITION_UPDATE' && e.type !== 'EXPEDITION_RESULT') {
        continue
      }
      const pe = toPersistFromExpedition(e)
      if (pe != null) out.push(pe)
    }
    return out
  }
}