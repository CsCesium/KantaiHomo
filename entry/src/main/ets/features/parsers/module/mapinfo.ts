import type { ApiDump } from '../../../infra/web/types';
import type { MapInfoUpdateEvent, AnyMapInfoEvt, MapGaugeRaw } from '../../../domain/events/mapinfo';
import type { LbasUpdateEvent } from '../../../domain/events/lbas';
import type { ApiBaseAirCorpsRaw } from '../../../domain/models/api/member';
import type { LbasBase, LbasSquadron } from '../../../domain/models/struct/lbas';
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

function normalizeMapinfoLbas(
  raw: ApiBaseAirCorpsRaw[],
  ctx: ParserCtx,
): LbasUpdateEvent | null {
  if (!raw.length) return null;

  const bases: LbasBase[] = raw
    .filter(d => typeof d.api_rid === 'number')
    .map(d => ({
      baseId:        d.api_rid,
      areaId:        d.api_area_id,
      name:          d.api_name,
      distanceBase:  d.api_distance.api_base,
      distanceBonus: d.api_distance.api_bonus,
      actionKind:    d.api_action_kind,
      squadrons:     (d.api_plane_info ?? []).map((p): LbasSquadron => ({
        squadronId: p.api_squadron_id,
        state:      p.api_state,
        slotId:     p.api_slotid ?? 0,
        count:      p.api_count    ?? 0,
        maxCount:   p.api_max_count ?? 0,
        cond:       p.api_cond     ?? 1,
      })),
    }));

  if (bases.length === 0) return null;
  return mkEvt(ctx, 'LBAS_UPDATE', ['LBAS', ctx.endpoint, ctx.ts], bases) as LbasUpdateEvent;
}

export function parseMapInfo(dump: ApiDump): (AnyMapInfoEvt | LbasUpdateEvent)[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const out: (AnyMapInfoEvt | LbasUpdateEvent)[] = [];

  const mapInfoEvts = parseMapInfoData(ctx);
  if (mapInfoEvts) out.push(...mapInfoEvts);

  // 活动海图中 api_air_base 包含当前基地航空队状态
  try {
    const js = parseSvdata<Record<string, unknown>>(dump.responseText);
    const airBaseArr = (js?.api_data as Record<string, unknown>)?.api_air_base;
    if (Array.isArray(airBaseArr) && airBaseArr.length > 0) {
      const lbasEvt = normalizeMapinfoLbas(airBaseArr as ApiBaseAirCorpsRaw[], ctx);
      if (lbasEvt) out.push(lbasEvt);
    }
  } catch (_) { /* ignore */ }

  return out.length > 0 ? out : null;
}
