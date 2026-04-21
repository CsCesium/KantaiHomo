import type { ApiDump } from '../../../infra/web/types';
import type { PortNdockEvent } from '../../../domain/events/port';
import { ApiNdockRaw } from '../../../domain/models/api/n_dock';
import { normalizeNdocks } from '../../../domain/models/normalizer/n_dock';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseSvdata } from '../../utils/common';

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/ndock', match: (url) => url.includes('/api_get_member/ndock') },
];

export function parseNdock(dump: ApiDump): PortNdockEvent[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const js = parseSvdata<{ api_data?: ApiNdockRaw[] }>(ctx.responseText);
  const data = js?.api_data;
  if (!Array.isArray(data)) return null;

  const ndocks = normalizeNdocks(data, ctx.ts);
  const evt = mkEvt(ctx, 'PORT_NDOCK', ['ndock-update', ctx.ts], ndocks) as PortNdockEvent;
  return [evt];
}
