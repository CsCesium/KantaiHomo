import type { ApiDump } from '../../../infra/web/types';
import { parseSlotItem } from '../module/slotitem';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const slotitemPipeline: DumpPipeline = {
  name: 'slotitem',
  match: (url) => url.includes('/api_get_member/slot_item'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseSlotItem(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(slotitemPipeline);
