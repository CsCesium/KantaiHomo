import type { ApiDump } from '../../../infra/web/types';
import type {
  AnyKousyouEvt,
  CreateShipStartEvent,
  DevItemEntry,
  DevItemResultEvent,
  GetShipResultEvent,
  KdockEntry,
  KdockUpdateEvent,
  RemodelSlotResultEvent,
} from '../../../domain/events/kousyou';
import type {
  ApiKousyouGetItemRaw,
  ApiReqKousyouCreateitemRespRaw,
  ApiReqKousyouGetshipRespRaw,
  ApiReqKousyouRemodelslotRespRaw,
} from '../../../domain/models/api/request';
import type { ApiKdockRaw } from '../../../domain/models/api/k_dock';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseSvdata } from '../../utils/common';

const EP_CREATEITEM = '/api_req_kousyou/createitem';
const EP_GETSHIP = '/api_req_kousyou/getship';
const EP_REMODEL = '/api_req_kousyou/remodel_slot';
const EP_CREATESHIP = '/api_req_kousyou/createship';
const EP_KDOCK = '/api_get_member/kdock';

const RULES: EndpointRule[] = [
  { endpoint: EP_CREATEITEM, match: (url) => url.includes(EP_CREATEITEM) },
  { endpoint: EP_GETSHIP, match: (url) => url.includes(EP_GETSHIP) },
  { endpoint: EP_REMODEL, match: (url) => url.includes(EP_REMODEL) },
  // 排除 createship_speedup（高速建造完成，无新建造信息）
  {
    endpoint: EP_CREATESHIP,
    match: (url) => url.includes(EP_CREATESHIP) && !url.includes('/api_req_kousyou/createship_speedup'),
  },
  { endpoint: EP_KDOCK, match: (url) => url.includes(EP_KDOCK) },
];

export function matchKousyouUrl(url: string): boolean {
  return detectEndpoint(url, RULES) !== null;
}

function parseCreateItem(ctx: ParserCtx): DevItemResultEvent | null {
  const js = parseSvdata<{ api_data?: ApiReqKousyouCreateitemRespRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data) return null;

  let items: DevItemEntry[] = [];
  if (Array.isArray(data.api_get_items)) {
    items = data.api_get_items.map((it: ApiKousyouGetItemRaw): DevItemEntry => {
      const masterId = it.api_slotitem_id ?? -1;
      return { uid: it.api_id ?? 0, masterId, success: masterId > 0 };
    });
  } else if (data.api_create_flag !== undefined) {
    // 旧单发格式
    const masterId = data.api_slot_item?.api_slotitem_id ?? -1;
    items = [{
      uid: data.api_slot_item?.api_id ?? 0,
      masterId,
      success: data.api_create_flag === 1 && masterId > 0,
    }];
  }
  if (items.length === 0) return null;

  return mkEvt(
    ctx,
    'KOUSYOU_DEV_RESULT',
    ['kousyou-dev', items.map(i => i.masterId).join('-'), ctx.ts],
    { items }
  ) as DevItemResultEvent;
}

function parseGetShip(ctx: ParserCtx): GetShipResultEvent | null {
  const js = parseSvdata<{ api_data?: ApiReqKousyouGetshipRespRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data || typeof data.api_ship_id !== 'number' || data.api_ship_id <= 0) return null;

  const kdockMatch = /api_kdock_id=(\d+)/.exec(ctx.requestBody ?? '');
  return mkEvt(
    ctx,
    'KOUSYOU_GETSHIP_RESULT',
    ['kousyou-getship', data.api_ship_id, ctx.ts],
    {
      kdockId: kdockMatch ? parseInt(kdockMatch[1]) : 0,
      shipUid: data.api_id ?? 0,
      shipMasterId: data.api_ship_id,
    }
  ) as GetShipResultEvent;
}

function parseRemodelSlot(ctx: ParserCtx): RemodelSlotResultEvent | null {
  const js = parseSvdata<{ api_data?: ApiReqKousyouRemodelslotRespRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data || data.api_remodel_flag === undefined) return null;

  const remodelIds = Array.isArray(data.api_remodel_id) ? data.api_remodel_id : [];
  const beforeMasterId = remodelIds[0] ?? 0;
  const afterMasterId = remodelIds[1] ?? beforeMasterId;
  return mkEvt(
    ctx,
    'KOUSYOU_REMODEL_RESULT',
    ['kousyou-remodel', beforeMasterId, ctx.ts],
    {
      success: data.api_remodel_flag === 1,
      beforeMasterId,
      afterMasterId,
      afterLevel: data.api_after_slot?.api_level ?? -1,
    }
  ) as RemodelSlotResultEvent;
}

function parseCreateShipStart(ctx: ParserCtx): CreateShipStartEvent | null {
  // 响应 api_data 为空对象，仅确认调用成功；建造信息来自请求参数
  const js = parseSvdata<{ api_result?: number }>(ctx.responseText);
  if (js?.api_result !== 1) return null;

  const body = ctx.requestBody ?? '';
  const kdockMatch = /api_kdock_id=(\d+)/.exec(body);
  if (!kdockMatch) return null;

  return mkEvt(
    ctx,
    'KOUSYOU_CREATESHIP_START',
    ['kousyou-createship', kdockMatch[1], ctx.ts],
    {
      kdockId: parseInt(kdockMatch[1]),
      isLarge: /api_large_flag=1/.test(body),
      highspeed: /api_highspeed=1/.test(body),
    }
  ) as CreateShipStartEvent;
}

function parseKdock(ctx: ParserCtx): KdockUpdateEvent | null {
  const js = parseSvdata<{ api_data?: ApiKdockRaw[] }>(ctx.responseText);
  const data = js?.api_data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const docks = data.map((raw: ApiKdockRaw): KdockEntry => ({
    dockId: raw.api_id ?? 0,
    state: raw.api_state ?? 0,
    shipMasterId: raw.api_created_ship_id ?? 0,
    completeTime: raw.api_complete_time ?? 0,
  }));
  return mkEvt(
    ctx,
    'KOUSYOU_KDOCK_UPDATE',
    ['kousyou-kdock', docks.map(d => `${d.dockId}-${d.shipMasterId}`).join('_'), ctx.ts],
    { docks }
  ) as KdockUpdateEvent;
}

export function parseKousyou(dump: ApiDump): AnyKousyouEvt[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  let evt: AnyKousyouEvt | null = null;
  switch (endpoint) {
    case EP_CREATEITEM:
      evt = parseCreateItem(ctx);
      break;
    case EP_GETSHIP:
      evt = parseGetShip(ctx);
      break;
    case EP_REMODEL:
      evt = parseRemodelSlot(ctx);
      break;
    case EP_CREATESHIP:
      evt = parseCreateShipStart(ctx);
      break;
    case EP_KDOCK:
      evt = parseKdock(ctx);
      break;
  }

  return evt ? [evt] : null;
}
