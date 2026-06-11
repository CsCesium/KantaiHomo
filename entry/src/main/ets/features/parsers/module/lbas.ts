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

import type { ApiBasePlaneRaw } from '../../../domain/models/api/member';
import type { LbasBase, LbasSquadron } from '../../../domain/models/struct/lbas';
import type { LbasUpdateEvent, AnyLbasEvt } from '../../../domain/events/lbas';
import type { ApiDump } from '../../../infra/web/types';
import { parseFormBody, parseSvdata } from '../../utils/common';
import { detectEndpoint, EndpointRule, mkEvt, ParserCtx } from './common';

interface ApiLbasDistanceProbe {
  api_base?: number;
  api_bonus?: number;
}

interface ApiLbasBaseProbe {
  api_area_id?: number;
  api_rid?: number;
  api_base_id?: number;
  api_name?: string;
  api_distance?: ApiLbasDistanceProbe;
  api_action_kind?: number;
  api_plane_info?: ApiBasePlaneRaw[];
}

type ApiLbasDataProbe = ApiLbasBaseProbe | ApiLbasBaseProbe[] | null | undefined;

interface ApiLbasRootProbe extends ApiLbasBaseProbe {
  api_data?: ApiLbasDataProbe;
}

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

function normalizeSquadron(p: ApiBasePlaneRaw): LbasSquadron {
  return {
    squadronId: p.api_squadron_id,
    state:      p.api_state,
    slotId:     p.api_slotid ?? 0,
    count:      p.api_count    ?? 0,
    maxCount:   p.api_max_count ?? 0,
    cond:       p.api_cond     ?? 1,
  };
}

function normalizeBase(
  raw: ApiLbasBaseProbe,
  fallbackAreaId: number = 0,
  fallbackBaseId: number = 0,
  fallbackActionKind: number = -1,
): LbasBase | null {
  const areaId = raw.api_area_id ?? fallbackAreaId;
  const baseId = raw.api_rid ?? raw.api_base_id ?? fallbackBaseId;
  if (areaId <= 0 || baseId <= 0) return null;

  return {
    baseId,
    areaId,
    name:          raw.api_name ?? '',
    distanceBase:  raw.api_distance?.api_base ?? -1,
    distanceBonus: raw.api_distance?.api_bonus ?? -1,
    actionKind:    raw.api_action_kind ?? fallbackActionKind,
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
function extractBases(
  apiData: ApiLbasDataProbe,
  fallbackAreaId: number = 0,
  fallbackBaseId: number = 0,
  fallbackActionKind: number = -1,
): LbasBase[] {
  if (!apiData) return [];

  if (Array.isArray(apiData)) {
    const bases: LbasBase[] = [];
    for (const data of apiData) {
      const base = normalizeBase(data, fallbackAreaId, fallbackBaseId, fallbackActionKind);
      if (base) bases.push(base);
    }
    return bases;
  }

  const base = normalizeBase(apiData, fallbackAreaId, fallbackBaseId, fallbackActionKind);
  return base ? [base] : [];
}

function responseApiData(root: ApiLbasRootProbe | ApiLbasBaseProbe[] | null): ApiLbasDataProbe {
  if (!root) return null;
  if (Array.isArray(root)) return root;
  return root.api_data !== undefined ? root.api_data : root;
}

function parseNumberList(raw: string): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part: string): number => parseInt(part.trim(), 10))
    .filter((value: number): boolean => Number.isFinite(value));
}

function basesFromSetActionRequest(dump: ApiDump): LbasBase[] {
  const params = parseFormBody(dump.requestBody);
  const areaId = params.getInt('api_area_id', 0);
  if (areaId <= 0) return [];

  const baseIds = parseNumberList(params.getString('api_base_id', ''));
  const actionKinds = parseNumberList(params.getString('api_action_kind', ''));
  const bases: LbasBase[] = [];
  for (let i = 0; i < baseIds.length; i++) {
    const baseId = baseIds[i];
    if (baseId <= 0) continue;
    bases.push({
      areaId,
      baseId,
      name: '',
      distanceBase: -1,
      distanceBonus: -1,
      actionKind: actionKinds[i] ?? actionKinds[0] ?? -1,
      squadrons: [],
    });
  }
  return bases;
}

function extractBasesForEndpoint(endpoint: string, dump: ApiDump, apiData: ApiLbasDataProbe): LbasBase[] {
  if (endpoint === '/api_req_air_corps/set_action') {
    return basesFromSetActionRequest(dump);
  }

  if (endpoint === '/api_req_air_corps/set_plane' || endpoint === '/api_req_air_corps/supply') {
    const params = parseFormBody(dump.requestBody);
    return extractBases(
      apiData,
      params.getInt('api_area_id', 0),
      params.getInt('api_base_id', 0),
      -1,
    );
  }

  return extractBases(apiData);
}

// ==================== 主入口 ====================

export function parseLbas(dump: ApiDump): AnyLbasEvt[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const root = parseSvdata<ApiLbasRootProbe | ApiLbasBaseProbe[]>(dump.responseText);
  if (!root) return null;

  const apiData = responseApiData(root);
  const bases = extractBasesForEndpoint(endpoint, dump, apiData);
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
