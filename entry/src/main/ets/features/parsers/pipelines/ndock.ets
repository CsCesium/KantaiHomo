import type { ApiDump } from '../../../infra/web/types';
import { parseNdock } from '../module/ndock';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const ndockPipeline: DumpPipeline = {
  name: 'ndock',
  match: (url) => url.includes('/api_get_member/ndock'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseNdock(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(ndockPipeline);
