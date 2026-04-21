import type { ApiDump } from '../../../infra/web/types';
import type { HandlerEvent } from '../../router/persist/type';
import { parseMapInfo } from '../module/mapinfo';
import { DumpPipeline, ParseResult, registerPipeline } from '../pipeline';

export const mapinfoPipeline: DumpPipeline = {
  name: 'mapinfo',
  match: (url) => url.includes('/api_get_member/mapinfo'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseMapInfo(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts as HandlerEvent[],
    };
  },
};

registerPipeline(mapinfoPipeline);
