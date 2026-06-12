import type { ApiDump } from '../../../infra/web/types';
import { parseKousyou, matchKousyouUrl } from '../module/kousyou';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const kousyouPipeline: DumpPipeline = {
  name: 'kousyou',
  match: (url) => matchKousyouUrl(url),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseKousyou(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(kousyouPipeline);
