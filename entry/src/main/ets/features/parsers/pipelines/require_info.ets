import type { ApiDump } from '../../../infra/web/types';
import { parseRequireInfo } from '../module/require_info';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const requireInfoPipeline: DumpPipeline = {
  name: 'require_info',
  match: (url) => url.includes('/api_get_member/require_info'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseRequireInfo(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(requireInfoPipeline);
