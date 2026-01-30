import { SessionBindEvent } from '../../../domain/events';
import { AnyPortEvt,
  PortBasicEvent,
  PortFleetsEvent,
  PortNdockEvent,
  PortResourcesEvent,
  PortShipsEvent,
  PortSnapshotEvent } from '../../../domain/events/port';
import { ApiPortRespRaw, normalizePort } from '../../../domain/models';
import { JsonObject, getObj, getStr, unwrapApiData } from '../../../domain/models/json';
import { ApiDump } from '../../../infra/web/types';
import { parseSvdata } from '../../utils/common';
import { detectEndpoint, EndpointRule, mkEvt, ParserCtx } from './common';

const RULES: EndpointRule[] = [
  { endpoint: '/api_port/port', match: (url: string) => url.includes('/api_port/port') },
]


function pickMemberIdFromPortPayload(payload: JsonObject): string {
  const basic = getObj(payload, 'api_basic');
  if (basic === null) return '';
  return getStr(basic, 'api_member_id', '');
}

export function parsePort(dump: ApiDump): (AnyPortEvt | SessionBindEvent)[] {
  const endpoint = detectEndpoint(dump.url, RULES)
  if (!endpoint) return null

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  }

  const root: JsonObject | null =  parseSvdata<any>(ctx.responseText)
  if (root === null) return []

  const payloadObj: JsonObject = unwrapApiData(root)

  const memberId: string = pickMemberIdFromPortPayload(payloadObj)
  const out: (AnyPortEvt | SessionBindEvent)[] = []
  if (memberId) {
    out.push(
      mkEvt(ctx, 'SESSION_BIND', ['SESSION_BIND', memberId, ctx.ts], { memberId })
    )
  }

  const raw: ApiPortRespRaw = payloadObj as ApiPortRespRaw
  const snap = normalizePort(raw, ctx.ts)

  const snapEv: PortSnapshotEvent =
    mkEvt(ctx, 'PORT_SNAPSHOT', ['PORT_SNAPSHOT', snap.updatedAt], snap)

  const basicEv: PortBasicEvent =
    mkEvt(ctx, 'PORT_BASIC', ['PORT_BASIC', snap.updatedAt], snap.admiral)

  const resEv: PortResourcesEvent =
    mkEvt(ctx, 'PORT_RESOURCES', ['PORT_RESOURCES', snap.updatedAt], snap.materials)

  const fleetsEv: PortFleetsEvent =
    mkEvt(ctx, 'PORT_FLEETS', ['PORT_FLEETS', snap.updatedAt], snap.decks)

  const ndockEv: PortNdockEvent =
    mkEvt(ctx, 'PORT_NDOCK', ['PORT_NDOCK', snap.updatedAt], snap.ndocks)

  const shipsEv: PortShipsEvent =
    mkEvt(ctx, 'PORT_SHIPS', ['PORT_SHIPS', snap.updatedAt], snap.ships)

  out.push(snapEv, basicEv, resEv, fleetsEv, ndockEv, shipsEv)
  return out
}