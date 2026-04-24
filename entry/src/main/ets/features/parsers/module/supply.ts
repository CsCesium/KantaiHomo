import type { ApiDump } from '../../../infra/web/types';
import type { SupplyChargeEvent } from '../../../domain/events/supply';
import type { ChargeShipPatch, ChargeResult } from '../../../domain/events/supply';
import { EndpointRule, ParserCtx, mkEvt, detectEndpoint } from './common';
import { parseSvdata } from '../../utils/common';

interface ApiChargeShipRaw {
  api_id: number;
  api_fuel: number;
  api_bull: number;
  api_onslot: number[];
}

// Actual charge response: api_material is [fuel, ammo, steel, bauxite], not ApiMaterialItemRaw[]
interface ApiChargeDataRaw {
  api_ship?: ApiChargeShipRaw[];
  api_material?: number[];
  api_use_bou?: number;
}

const RULES: EndpointRule[] = [
  { endpoint: '/api_req_hokyu/charge', match: (url) => url.includes('/api_req_hokyu/charge') },
];

export function parseSupplyCharge(dump: ApiDump): SupplyChargeEvent[] | null {
  const endpoint = detectEndpoint(dump.url, RULES);
  if (!endpoint) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const js = parseSvdata<{ api_data?: ApiChargeDataRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data) return null;

  const ships: ChargeShipPatch[] = (data.api_ship ?? []).map(s => ({
    uid: s.api_id,
    fuel: s.api_fuel,
    ammo: s.api_bull,
    onslot: Array.isArray(s.api_onslot) ? [...s.api_onslot] : [],
  }));

  const mat = data.api_material ?? [];
  const result: ChargeResult = {
    ships,
    fuel: mat[0] ?? 0,
    ammo: mat[1] ?? 0,
    steel: mat[2] ?? 0,
    bauxite: mat[3] ?? 0,
    updatedAt: ctx.ts,
  };

  const evt = mkEvt(ctx, 'SUPPLY_CHARGE', ['supply-charge', ctx.ts], result) as SupplyChargeEvent;
  return [evt];
}
