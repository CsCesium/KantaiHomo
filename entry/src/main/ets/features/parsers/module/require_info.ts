import type { ApiDump } from '../../../infra/web/types';
import type { SlotItemsUpdateEvent } from '../../../domain/events/slotitem';
import type { RequireInfoUpdateEvent } from '../../../domain/events/require_info';
import type { ApiRequireInfoRespRaw } from '../../../domain/models/api/require_info';
import { normalizeRequireInfo } from '../../../domain/models/normalizer/require_info';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseSvdata } from '../../utils/common';

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/require_info', match: (url) => url.includes('/api_get_member/require_info') },
];

type RequireInfoEvt = SlotItemsUpdateEvent | RequireInfoUpdateEvent;

export function parseRequireInfo(dump: ApiDump): RequireInfoEvt[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const js = parseSvdata<{ api_data?: ApiRequireInfoRespRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data) return null;

  const snapshot = normalizeRequireInfo(data, ctx.ts);
  const out: RequireInfoEvt[] = [];

  if (snapshot.slotItems.length > 0) {
    out.push(mkEvt(
      ctx,
      'SLOTITEMS_UPDATE',
      ['require-info-slotitems', snapshot.slotItems.length, ctx.ts],
      snapshot.slotItems
    ) as SlotItemsUpdateEvent);
  }

  out.push(mkEvt(
    ctx,
    'REQUIRE_INFO_UPDATE',
    ['require-info', ctx.ts],
    {
      admiral: snapshot.admiral,
      kdocks: snapshot.kdocks,
      useItems: snapshot.useItems,
    }
  ) as RequireInfoUpdateEvent);

  return out.length > 0 ? out : null;
}
