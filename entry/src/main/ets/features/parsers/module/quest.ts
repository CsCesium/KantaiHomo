import { AnyQuestEvt, QuestClaimedEvent, QuestListEvent, QuestStateChangedEvent } from "../../../domain/events";
import { ApiQuestListRespRaw, normalizeQuestListPage } from "../../../domain/models";
import { JsonObject, unwrapApiData } from "../../../domain/models/json";
import { ApiDump } from "../../../infra/web/types";
import { parseFormBody, parseSvdata } from "../../utils/common";
import { detectEndpoint, EndpointRule, mkEvt, ParserCtx } from "./common";

const RULES: EndpointRule[] = [
  { endpoint: '/api_get_member/questlist', match: (url: string) => url.includes('/api_get_member/questlist') },
  { endpoint: '/api_req_quest/clearitemget', match: (url: string) => url.includes('/api_req_quest/clearitemget') },
  { endpoint: '/api_req_quest/start', match: (url: string) => url.includes('/api_req_quest/start') },
  { endpoint: '/api_req_quest/stop', match: (url: string) => url.includes('/api_req_quest/stop') },
]

function parseQuestList(ctx: ParserCtx): QuestListEvent[] {
  const root: JsonObject | null = parseSvdata<any>(ctx.responseText)
  if (root === null) return [];

  const payloadObj: JsonObject = unwrapApiData(root)
  const raw = payloadObj as ApiQuestListRespRaw;
  const params = parseFormBody(ctx.requestBody);
  const tabIdRaw = Number(params.get('api_tab_id'));
  const tabId = Number.isFinite(tabIdRaw) ? tabIdRaw : undefined;
  const page = normalizeQuestListPage(raw, ctx.ts, tabId);

  const questListEv: QuestListEvent = mkEvt(
    ctx,
    'QUEST_LIST',
    ['QUEST_LIST', page.page, page.updatedAt],
    page
  );

  return [questListEv];
}

function parseQuestStateChanged(ctx: ParserCtx, state: 1 | 2): QuestStateChangedEvent[] {
  const root = parseSvdata<{ api_result?: number }>(ctx.responseText);
  if (root?.api_result !== 1) return [];

  const params = parseFormBody(ctx.requestBody);
  const questId = Number(params.get('api_quest_id') ?? 0);
  if (!Number.isFinite(questId) || questId <= 0) return [];

  return [mkEvt(
    ctx,
    'QUEST_STATE_CHANGED',
    ['QUEST_STATE_CHANGED', questId, state, ctx.ts],
    { questId, state, changedAt: ctx.ts }
  ) as QuestStateChangedEvent];
}

function parseQuestClaimed(ctx: ParserCtx): QuestClaimedEvent[] {
  const root = parseSvdata<{ api_result?: number }>(ctx.responseText);
  if (root?.api_result !== 1) return [];

  const params = parseFormBody(ctx.requestBody);
  const questId = Number(params.get('api_quest_id') ?? 0);
  if (!Number.isFinite(questId) || questId <= 0) return [];

  const questClaimedEv: QuestClaimedEvent = mkEvt(
    ctx,
    'QUEST_CLAIMED',
    ['QUEST_CLAIMED', questId, ctx.ts],
    { questId, claimedAt: ctx.ts }
  );

  return [questClaimedEv];
}

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

  switch (endpoint) {
    case '/api_get_member/questlist':
      return parseQuestList(ctx);
    case '/api_req_quest/clearitemget':
      return parseQuestClaimed(ctx);
    case '/api_req_quest/start':
      return parseQuestStateChanged(ctx, 2);
    case '/api_req_quest/stop':
      return parseQuestStateChanged(ctx, 1);
    default:
      return [];
  }
}
