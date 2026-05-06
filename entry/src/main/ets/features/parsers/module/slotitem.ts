import type { ApiDump } from '../../../infra/web/types';
import type { SlotItemsUpdateEvent } from '../../../domain/events/slotitem';
import type { ApiSlotItemRespRaw } from '../../../domain/models/api/member';
import { normalizeSlotItems } from '../../../domain/models/normalizer/slotitem';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseSvdata } from '../../utils/common';

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/slot_item', match: (url) => url.includes('/api_get_member/slot_item') },
];

export function parseSlotItem(dump: ApiDump): SlotItemsUpdateEvent[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const js = parseSvdata<{ api_data?: ApiSlotItemRespRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data || !Array.isArray(data.api_slot_item)) return null;

  const slotItems = normalizeSlotItems(data.api_slot_item, ctx.ts);
  const evt = mkEvt(
    ctx,
    'SLOTITEMS_UPDATE',
    ['slotitems-update', slotItems.length, ctx.ts],
    slotItems
  ) as SlotItemsUpdateEvent;

  return [evt];
}
