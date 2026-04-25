/**
 * LBAS Parser - 基地航空队解析器
 *
 * 处理的 API 端点：
 *   api_get_member/base_air_corps  — 全量基地状态
 *   api_req_air_corps/set_action   — 设置出撃/防空模式
 *   api_req_air_corps/set_plane    — 配置中队机体
 *   api_req_air_corps/expand_base  — 扩展航程
 *   api_req_air_corps/supply       — 补充机体
 */

import type { ApiBaseAirCorpsRaw } from '../../../domain/models/api/member';
import type { LbasBase, LbasSquadron } from '../../../domain/models/struct/lbas';
import type { LbasUpdateEvent, AnyLbasEvt } from '../../../domain/events/lbas';
import type { ApiDump } from '../../../infra/web/types';
import { parseSvdata } from '../../utils/common';
import { detectEndpoint, EndpointRule, mkEvt, ParserCtx } from './common';

// ==================== 端点规则 ====================

const RULES: EndpointRule[] = [
  {
    endpoint: '/api_get_member/base_air_corps',
    match: (url: string) => url.includes('/api_get_member/base_air_corps'),
  },
  {
    endpoint: '/api_req_air_corps/set_action',
    match: (url: string) => url.includes('/api_req_air_corps/set_action'),
  },
  {
    endpoint: '/api_req_air_corps/set_plane',
    match: (url: string) => url.includes('/api_req_air_corps/set_plane'),
  },
  {
    endpoint: '/api_req_air_corps/expand_base',
    match: (url: string) => url.includes('/api_req_air_corps/expand_base'),
  },
  {
    endpoint: '/api_req_air_corps/supply',
    match: (url: string) => url.includes('/api_req_air_corps/supply'),
  },
];

export function isLbasUrl(url: string): boolean {
  return RULES.some(r => r.match(url));
}

// ==================== 规范化 ====================

function normalizeSquadron(p: ApiBaseAirCorpsRaw['api_plane_info'][number]): LbasSquadron {
  return {
    squadronId: p.api_squadron_id,
    state:      p.api_state,
    slotId:     p.api_slotid ?? 0,
    count:      p.api_count    ?? 0,
    maxCount:   p.api_max_count ?? 0,
    cond:       p.api_cond     ?? 1,
  };
}

function normalizeBase(raw: ApiBaseAirCorpsRaw): LbasBase {
  return {
    baseId:        raw.api_rid,
    areaId:        raw.api_area_id,
    name:          raw.api_name,
    distanceBase:  raw.api_distance.api_base,
    distanceBonus: raw.api_distance.api_bonus,
    actionKind:    raw.api_action_kind,
    squadrons:     (raw.api_plane_info ?? []).map(normalizeSquadron),
  };
}

/**
 * 从 api_data 中提取基地列表。
 * api_data 可能是：
 *   - ApiBaseAirCorpsRaw[]       (base_air_corps 全量响应)
 *   - ApiBaseAirCorpsRaw         (单基地操作响应)
 *   - null / undefined           (仅返回 api_result 的操作)
 */
function extractBases(apiData: unknown): LbasBase[] {
  if (!apiData) return [];

  if (Array.isArray(apiData)) {
    return (apiData as ApiBaseAirCorpsRaw[])
      .filter(d => d && typeof d.api_rid === 'number')
      .map(normalizeBase);
  }

  const d = apiData as ApiBaseAirCorpsRaw;
  if (typeof d.api_rid === 'number') {
    return [normalizeBase(d)];
  }

  return [];
}

// ==================== 主入口 ====================

export function parseLbas(dump: ApiDump): AnyLbasEvt[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const root = parseSvdata<Record<string, unknown>>(dump.responseText);
  if (!root) return null;

  const apiData = root.api_data ?? root;
  const bases = extractBases(apiData);
  if (bases.length === 0) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const evt: LbasUpdateEvent = mkEvt(ctx, 'LBAS_UPDATE', ['LBAS', endpoint, ctx.ts], bases);
  return [evt];
}
