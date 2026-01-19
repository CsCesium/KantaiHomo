import { PayloadEvent } from "../../../domain/events"
import { makeEventId } from "../utils/common"

export interface ParserCtx {
  ts: number
  url: string
  endpoint: string
  requestBody: string
  responseText: string
}

export type EndpointRule = {
  endpoint: string
  match: (url: string) => boolean
}

export function detectEndpoint(url: string, rules: EndpointRule[]): string | null {
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i]
    if (r.match(url)) return r.endpoint
  }
  return null
}


export function mkEvt<TType extends string, TPayload>(
  ctx: ParserCtx,
  type: TType,
  idParts: (string | number)[],
  payload: TPayload
): PayloadEvent<TType, TPayload> {
  return {
    id: makeEventId(idParts),
    type,
    payload,
    timestamp: ctx.ts,
    source: 'web',
    endpoint: ctx.endpoint,
  } as PayloadEvent<TType, TPayload>
}