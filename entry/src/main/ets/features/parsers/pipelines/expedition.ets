import { ApiDump } from '../../../infra/web/types'
import { parseExpedition } from '../module'
import { DumpPipeline, ParseResult } from '../pipeline'

export const expeditionPipeline: DumpPipeline = {
  name: 'expedition',
  match: (url) => {
    return url.includes('/api_req_mission/')
      || url.includes('/api_get_member/deck');
  },

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseExpedition(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};