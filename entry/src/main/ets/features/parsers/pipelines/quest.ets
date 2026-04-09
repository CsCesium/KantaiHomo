import { ApiDump } from '../../../infra/web/types'
import { parseQuest } from '../module'
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline'

export const questPipeline: DumpPipeline = {
  name: 'quest',
  match: (url) => url.includes('/api_get_member/questlist'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseQuest(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(questPipeline);
