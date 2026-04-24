import type { ApiDump } from '../../../infra/web/types';
import { parseSupplyCharge } from '../module/supply';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const supplyPipeline: DumpPipeline = {
  name: 'supply',
  match: (url) => url.includes('/api_req_hokyu/charge'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseSupplyCharge(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(supplyPipeline);
