import { ApiDump } from '../../../infra/web/types';
import { isLbasUrl, parseLbas } from '../module/lbas';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const lbasPipeline: DumpPipeline = {
  name: 'lbas',
  match: isLbasUrl,

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseLbas(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(lbasPipeline);
