import { ApiDump } from "../../../infra/web/types";
import { isBattleUrl, parseBattle } from "../module/battle";
import { DumpPipeline, ParseResult, registerPipeline } from "../pipeline";

export const battlePipeline: DumpPipeline = {
  name: 'battle',
  match: isBattleUrl,

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parseBattle(dump);
    if (!evts?.length) return null;

    return {
      preEvents: [],
      mainEvents: evts,
    };
  }
};

registerPipeline(battlePipeline);