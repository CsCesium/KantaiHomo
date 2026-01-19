import { SessionBindEvent } from "../../../domain/events"
import { AnyPortEvt } from "../../../domain/events/port"
import { ApiDump } from "../../../infra/web/types"
import { PersistEvent, PersistEventPort, PersistSessionBindEvent, PortEventPayloads } from "../../router/persist/type"
import { parsePort } from "../module"
import { DumpPipeline } from "../pipeline"

export function toPersistFromSessionBind(e: SessionBindEvent): PersistSessionBindEvent {
  return {
    id: e.id,
    type: 'PORT',
    timestamp: e.timestamp,
    source: e.source,
    endpoint: e.endpoint,
    payload: {kind:'session', data:e.payload},
  }
}

function toPersistFromPort(e:AnyPortEvt):PersistEventPort|null{
  let payload: PortEventPayloads | null = null

  switch (e.type) {
    case 'PORT_SNAPSHOT':
      payload = { kind: 'snapshot', data: e.payload }
      break

    case 'PORT_BASIC':
      payload = { kind: 'admiral', data: e.payload }
      break

    case 'PORT_RESOURCES':
      payload = { kind: 'material', data: e.payload }
      break

    case 'PORT_FLEETS':
      payload = { kind: 'fleet', data: e.payload }
      break

    case 'PORT_NDOCK':
      payload = { kind: 'ndock', data: e.payload }
      break

    case 'PORT_KDOCK':
      payload = { kind: 'kdock', data: e.payload }
      break

    case 'PORT_SHIPS':
      payload = { kind: 'ship', data: e.payload }
      break

    case 'PORT_SLOTITEMS':
      payload = { kind: 'slotitem', data: e.payload }
      break

    default:
      return null
  }

  return {
    id: e.id,
    type: 'PORT',
    timestamp: e.timestamp,
    source: e.source,
    endpoint: e.endpoint,
    payload,
  }
}

export const portPipeline: DumpPipeline = {
  name: 'port',
  match: (url: string) => url.indexOf('/api_port/port') >= 0,
  parse: (dump: ApiDump) => {
    const evts = parsePort(dump) ?? []
    if (!evts.length) return []

    const out: PersistEvent[] = []
    for (const e of evts) {
      if (e.type === 'SESSION_BIND') {
        out.push(toPersistFromSessionBind(e))
      } else {
        const pe = toPersistFromPort(e)
        if (pe) out.push(pe)
      }
    }
    return out
  }
}