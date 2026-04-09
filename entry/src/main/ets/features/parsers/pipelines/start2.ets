import { ApiDump } from '../../../infra/web/types';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';
import { parseStart2 } from '../module/start2';

const start2Pipeline: DumpPipeline = {
  name: 'start2',
  match: (url) => url.includes('/api_start2'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseStart2(dump);
    if (!evts?.length) return null;
    return { preEvents: [], mainEvents: evts };
  },
};

registerPipeline(start2Pipeline);
