//entry/src/main/ets/features/parsers/expedition.ts
import type { ApiDump } from '../../../infra/web/types';
import { parseSvdata, parseFormBody, makeEventId} from "../utils/common"

import type {
  ExpeditionStartEvent,
  ExpeditionUpdateEvent,
  ExpeditionResultEvent,
  ExpeditionCatalogEvent
} from '../../../domain/events/expedition'
import {
  ApiMissionStartRespRaw,
  normalizeMissionStart,
  ApiMissionResultRespRaw,
  normalizeMissionResult,
  ApiDeckMissionTuple,
  normalizeDeckMission,
  normalizeMissionCatalog
} from '../../../domain/models';


export function parseExpedition(
  dump: ApiDump
): (ExpeditionStartEvent | ExpeditionUpdateEvent | ExpeditionResultEvent | ExpeditionCatalogEvent)[] | null {
  const { url, requestBody, responseText } = dump;

  if (url.includes('/api_req_mission/start')) {
    const params = parseFormBody(requestBody);
    const deckId = Number(params.get('api_deck_id') ?? 0);
    const missionId = Number(params.get('api_mission_id') ?? 0);

    const js = parseSvdata<any>(responseText);
    const raw = js?.api_data as ApiMissionStartRespRaw | undefined;
    if (!raw) return null;

    const payload = normalizeMissionStart(deckId, missionId, raw);
    const evt: ExpeditionStartEvent = {
      id: makeEventId(['ex-start', deckId, missionId, payload.complTime]),
      type: 'EXPEDITION_START',
      payload,
      timestamp: Date.now(),
      source: 'web',
      endpoint: '/api_req_mission/start',
    };
    return [evt];
  }

  // 2) 远征结果 /api_req_mission/result
  if (url.includes('/api_req_mission/result')) {
    const params = parseFormBody(requestBody);
    const deckId = Number(params.get('api_deck_id') ?? 0);
    const missionId = Number(params.get('api_mission_id') ?? 0);

    const js = parseSvdata<any>(responseText);
    const raw = js?.api_data as ApiMissionResultRespRaw | undefined;
    if (!raw) return null;

    const payload = normalizeMissionResult(deckId, missionId, raw);
    const evt: ExpeditionResultEvent = {
      id: makeEventId(['ex-result', deckId, missionId, payload.finishedAt]),
      type: 'EXPEDITION_RESULT',
      payload,
      timestamp: Date.now(),
      source: 'web',
      endpoint: '/api_req_mission/result',
    };
    return [evt];
  }

  // 3) 舰队状态（含远征计时）/api_get_member/deck 或 /api_port/port
  if (url.includes('/api_get_member/deck') || url.includes('/api_port/port')) {
    const js = parseSvdata<any>(responseText);
    const decks = js?.api_data?.api_deck ?? js?.api_data?.api_deck_port;
    if (!Array.isArray(decks)) return null;

    const states = decks.map((d: any, idx: number) => {
      const deckId = d.api_id ?? (idx + 1);
      const tuple = d.api_mission as ApiDeckMissionTuple;
      return normalizeDeckMission(deckId, tuple);
    });

    const evt: ExpeditionUpdateEvent = {
      id: makeEventId(['ex-update', Date.now()]),
      type: 'EXPEDITION_UPDATE',
      payload: states,
      timestamp: Date.now(),
      source: 'web',
      endpoint: url.includes('/api_port/port') ? '/api_port/port' : '/api_get_member/deck',
    };
    return [evt];
  }

  if (url.includes('/api_start2')) {
    const js = parseSvdata<any>(responseText);
    const arr = js?.api_data?.api_mst_mission as any[];
    if (!Array.isArray(arr)) return null;

    const list = arr.map(normalizeMissionCatalog);
    const evt: ExpeditionCatalogEvent = {
      id: makeEventId(['ex-catalog', list.length, Date.now()]),
      type: 'EXPEDITION_CATALOG',
      payload: list,
      timestamp: Date.now(),
      source: 'web',
      endpoint: '/api_start2',
    };
    return [evt];
  }
  return null;
}