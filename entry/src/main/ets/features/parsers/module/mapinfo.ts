import type { ApiDump } from '../../../infra/web/types';
import type { MapInfoUpdateEvent, AnyMapInfoEvt, MapGaugeRaw } from '../../../domain/events/mapinfo';
import type { LbasUpdateEvent } from '../../../domain/events/lbas';
import type { ApiBaseAirCorpsRaw } from '../../../domain/models/api/member';
import type { LbasBase, LbasSquadron } from '../../../domain/models/struct/lbas';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseFormBody, parseSvdata } from '../../utils/common';

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/mapinfo', match: (url: string) => url.includes('/api_get_member/mapinfo') },
  { endpoint: '/api_req_map/select_eventmap_rank', match: (url: string) => url.includes('/api_req_map/select_eventmap_rank') },
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
    let gaugeType = typeof e.api_gauge_type === 'number' ? e.api_gauge_type : null;
    let gaugeNum = typeof e.api_gauge_num === 'number' ? e.api_gauge_num : 1;

    let hpNow: number | null = null;
    let hpMax: number | null = null;
    let requiredDefeats: number | null = null;

    // 月度 EO 海图：api_required_defeat_count 直接挂在 map entry 顶层。
    if (typeof e.api_required_defeat_count === 'number') {
      requiredDefeats = e.api_required_defeat_count;
    }

    // 活动海图：HP 数据 + (覆盖式的) required_defeat_count 在 api_eventmap 里。
    const eventmap = e.api_eventmap as Record<string, unknown> | null;
    if (eventmap && typeof eventmap === 'object') {
      hpNow = typeof eventmap.api_now_maphp === 'number' ? eventmap.api_now_maphp : null;
      hpMax = typeof eventmap.api_max_maphp === 'number' ? eventmap.api_max_maphp : null;
      // 多段活动海域的当前 gauge 编号/类型在 api_eventmap 内；顶层字段只是兼容回退。
      gaugeType = typeof eventmap.api_gauge_type === 'number' ? eventmap.api_gauge_type : gaugeType;
      gaugeNum = typeof eventmap.api_gauge_num === 'number' ? eventmap.api_gauge_num : gaugeNum;
      if (typeof eventmap.api_required_defeat_count === 'number') {
        requiredDefeats = eventmap.api_required_defeat_count;
      }
    }

    // 未选择活动难度时服务端用 9999/9999 占位；这不是可展示的真实血条。
    const placeholderHp = hpNow === 9999 && hpMax === 9999;
    if (placeholderHp) {
      hpNow = null;
      hpMax = null;
    }

    // Include event gauges and EO gauges. EO maps may have zero defeated bosses
    // while still needing kills, so requiredDefeats is the reliable display gate.
    const hasGaugeProgress = (hpMax !== null && hpMax > 0) ||
      (requiredDefeats !== null && requiredDefeats > 0) || defeatCount > 0;
    const isUnselectedEventGauge = !!eventmap && placeholderHp;
    if ((gaugeType !== null && !isUnselectedEventGauge) || hasGaugeProgress) {
      gauges.push({ mapId, cleared, defeatCount, gaugeType, gaugeNum, hpNow, hpMax, requiredDefeats });
    }
  }

  if (gauges.length === 0) return null;

  const evt = mkEvt(ctx, 'MAP_INFO_UPDATE', ['mapinfo', ctx.ts], gauges) as MapInfoUpdateEvent;
  return [evt];
}

/**
 * 选择活动难度后，游戏不会立刻重新请求 mapinfo；正确的多段血条会直接放在
 * select_eventmap_rank 响应的 api_maphp 中。把它作为局部 MAP_INFO_UPDATE 发出，
 * 由 handler 合并到现有海域列表。
 */
function parseSelectedEventMapRank(ctx: ParserCtx): MapInfoUpdateEvent[] | null {
  const js = parseSvdata<Record<string, unknown>>(ctx.responseText);
  const data = js?.api_data as Record<string, unknown> | undefined;
  if (!data) return null;

  const params = parseFormBody(ctx.requestBody);
  const areaId = Number(params.get('api_maparea_id') ?? 0);
  const mapNo = Number(params.get('api_map_no') ?? 0);
  if (!Number.isFinite(areaId) || !Number.isFinite(mapNo) || areaId <= 0 || mapNo <= 0) return null;

  const mapHp = data.api_maphp as Record<string, unknown> | undefined;
  let hpNow: number | null = null;
  let hpMax: number | null = null;
  let gaugeType: number | null = null;
  let gaugeNum = 1;

  if (mapHp && typeof mapHp === 'object') {
    hpNow = typeof mapHp.api_now_maphp === 'number' ? mapHp.api_now_maphp : null;
    hpMax = typeof mapHp.api_max_maphp === 'number' ? mapHp.api_max_maphp : null;
    gaugeType = typeof mapHp.api_gauge_type === 'number' ? mapHp.api_gauge_type : null;
    gaugeNum = typeof mapHp.api_gauge_num === 'number' ? mapHp.api_gauge_num : 1;
  } else if (typeof data.api_max_maphp === 'number') {
    // 旧活动接口只给最大值；选难度后血条从满血开始。
    hpNow = data.api_max_maphp;
    hpMax = data.api_max_maphp;
  }

  if (hpNow === null || hpMax === null || hpMax <= 0) return null;

  const gauge: MapGaugeRaw = {
    mapId: areaId * 10 + mapNo,
    cleared: false,
    defeatCount: 0,
    gaugeType,
    gaugeNum,
    hpNow,
    hpMax,
    requiredDefeats: null,
  };
  return [mkEvt(ctx, 'MAP_INFO_UPDATE', ['maprank', gauge.mapId, gauge.gaugeNum, ctx.ts], [gauge]) as MapInfoUpdateEvent];
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

  if (endpoint === '/api_req_map/select_eventmap_rank') {
    return parseSelectedEventMapRank(ctx);
  }

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
