import { AnyQuestEvt, QuestListEvent } from "../../../domain/events";
import { ApiQuestListRespRaw, normalizeQuestListPage } from "../../../domain/models";
import { JsonObject, unwrapApiData } from "../../../domain/models/json";
import { ApiDump } from "../../../infra/web/types";
import { parseSvdata } from "../../utils/common";
import { detectEndpoint, EndpointRule, mkEvt, ParserCtx } from "./common";

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/questlist', match: (url: string) => url.includes('/api_get_member/questlist') },
]

export function parseQuest(dump: ApiDump): AnyQuestEvt[] {
  const endpoint = detectEndpoint(dump.url, RULES)
  if (!endpoint) return [];

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint,
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  }

  const root: JsonObject | null = parseSvdata<any>(ctx.responseText)
  if (root === null) return [];

  const payloadObj: JsonObject = unwrapApiData(root)
  const raw = payloadObj as ApiQuestListRespRaw;
  const page = normalizeQuestListPage(raw, ctx.ts);

  const questListEv: QuestListEvent = mkEvt(
    ctx,
    'QUEST_LIST',
    ['QUEST_LIST', page.page, page.updatedAt],
    page
  );

  return [questListEv];
}
