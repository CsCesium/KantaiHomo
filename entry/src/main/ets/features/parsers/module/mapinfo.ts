import type { ApiDump } from '../../../infra/web/types';
import type { MapInfoUpdateEvent, AnyMapInfoEvt, MapGaugeRaw } from '../../../domain/events/mapinfo';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseSvdata } from '../../utils/common';

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/mapinfo', match: (url: string) => url.includes('/api_get_member/mapinfo') },
];

function parseMapInfoData(ctx: ParserCtx): MapInfoUpdateEvent[] | null {
  const js = parseSvdata<Record<string, unknown>>(ctx.responseText);
  const mapInfoArr = (js?.api_data as Record<string, unknown>)?.api_map_info;
  if (!Array.isArray(mapInfoArr)) return null;

  const gauges: MapGaugeRaw[] = [];

  for (const entry of mapInfoArr) {
    const e = entry as Record<string, unknown>;
    const mapId = typeof e.api_id === 'number' ? e.api_id : 0;
    if (mapId === 0) continue;

    const cleared = e.api_cleared === 1;
    const defeatCount = typeof e.api_defeat_count === 'number' ? e.api_defeat_count : 0;
    const gaugeType = typeof e.api_gauge_type === 'number' ? e.api_gauge_type : null;
    const gaugeNum = typeof e.api_gauge_num === 'number' ? e.api_gauge_num : 1;

    let hpNow: number | null = null;
    let hpMax: number | null = null;
    let requiredDefeats: number | null = null;

    const eventmap = e.api_eventmap as Record<string, unknown> | null;
    if (eventmap && typeof eventmap === 'object') {
      hpNow = typeof eventmap.api_now_maphp === 'number' ? eventmap.api_now_maphp : null;
      hpMax = typeof eventmap.api_max_maphp === 'number' ? eventmap.api_max_maphp : null;
      requiredDefeats = typeof eventmap.api_required_defeat_count === 'number'
        ? eventmap.api_required_defeat_count
        : null;
    }

    // Only include maps that have a gauge or non-zero defeat count (EO maps)
    if (gaugeType !== null || defeatCount > 0) {
      gauges.push({ mapId, cleared, defeatCount, gaugeType, gaugeNum, hpNow, hpMax, requiredDefeats });
    }
  }

  if (gauges.length === 0) return null;

  const evt = mkEvt(ctx, 'MAP_INFO_UPDATE', ['mapinfo', ctx.ts], gauges) as MapInfoUpdateEvent;
  return [evt];
}

export function parseMapInfo(dump: ApiDump): AnyMapInfoEvt[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  return parseMapInfoData(ctx);
}
