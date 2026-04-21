import type { ApiDump } from '../../../infra/web/types';
import type {
  AnyStart2Evt,
  ShipMasterCatalogEvent,
  SlotItemMasterCatalogEvent,
  MissionMasterCatalogEvent,
  ShipGraphCatalogEvent,
} from '../../../domain/events/start2';
import { ApiStart2DataRaw } from '../../../domain/models/api/start2';
import { mkEvt, ParserCtx } from './common';
import { parseSvdata } from '../../utils/common';
import { extractServerBase } from '../../game/shipGraph';

export function parseStart2(dump: ApiDump): AnyStart2Evt[] | null {
  if (!dump.url?.includes('/api_start2')) return null;

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint: '/api_start2',
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  const js = parseSvdata<{ api_data?: ApiStart2DataRaw }>(ctx.responseText);
  const data = js?.api_data;
  if (!data) return [];

  const out: AnyStart2Evt[] = [];

  if (Array.isArray(data.api_mst_ship) && data.api_mst_ship.length > 0) {
    out.push(
      mkEvt(ctx, 'SHIP_MASTER_CATALOG',
        ['ship-mst', data.api_mst_ship.length, ctx.ts],
        data.api_mst_ship
      ) as ShipMasterCatalogEvent
    );
  }

  if (Array.isArray(data.api_mst_slotitem) && data.api_mst_slotitem.length > 0) {
    out.push(
      mkEvt(ctx, 'SLOTITEM_MASTER_CATALOG',
        ['slotitem-mst', data.api_mst_slotitem.length, ctx.ts],
        data.api_mst_slotitem
      ) as SlotItemMasterCatalogEvent
    );
  }

  if (Array.isArray(data.api_mst_mission) && data.api_mst_mission.length > 0) {
    out.push(
      mkEvt(ctx, 'MISSION_MASTER_CATALOG',
        ['mission-mst', data.api_mst_mission.length, ctx.ts],
        data.api_mst_mission
      ) as MissionMasterCatalogEvent
    );
  }

  if (Array.isArray(data.api_mst_shipgraph) && data.api_mst_shipgraph.length > 0) {
    const serverBase = extractServerBase(dump.url) ?? '';
    out.push(
      mkEvt(ctx, 'SHIP_GRAPH_CATALOG',
        ['ship-graph-mst', data.api_mst_shipgraph.length, ctx.ts],
        { graphs: data.api_mst_shipgraph, serverBase }
      ) as ShipGraphCatalogEvent
    );
  }

  return out;
}
