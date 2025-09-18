import {
  ExpeditionCatalogEvent,
  ExpeditionResultEvent,
  ExpeditionStartEvent,
  ExpeditionUpdateEvent
} from "../../../../domain/events/expedition";
import { ApiDump } from "../../../../infra/web/types";
import { parseExpedition } from "../../../parsers/expedition";
import { persistEvent } from "./..";
import type { PersistDeps, PersistEvent } from '../type';

import '../handlers/expeditionHandler.ets';

type AnyEvt =
  | ExpeditionStartEvent
  | ExpeditionUpdateEvent
  | ExpeditionResultEvent
  | ExpeditionCatalogEvent;

function toPersist(e: AnyEvt): PersistEvent | null {
  switch (e.type) {
    case 'EXPEDITION_START':
      return {
        id: e.id,
        type: 'EXPEDITION',
        timestamp: e.timestamp,
        source: e.source,
        raw: e.raw,
        endpoint: e.endpoint,
        payload: { kind: 'start', data: e.payload }
      };
    case 'EXPEDITION_UPDATE':
      return {
        id: e.id,
        type: 'EXPEDITION',
        timestamp: e.timestamp,
        source: e.source,
        raw: e.raw,
        endpoint: e.endpoint,
        payload: { kind: 'slotState', data: e.payload }
      };
    case 'EXPEDITION_RESULT':
      return {
        id: e.id,
        type: 'EXPEDITION',
        timestamp: e.timestamp,
        source: e.source,
        raw: e.raw,
        endpoint: e.endpoint,
        payload: { kind: 'result', data: e.payload }
      };
    //case 'EXPEDITION_CATALOG':return { id: e.id, type: 'EXPEDITION', timestamp: e.timestamp, source: e.source, raw: e.raw, endpoint: e.endpoint, payload: { kind: 'catalog',  data: e.payload } };
    default:
      return null;
  }
}

export async function ingestDump(dump: ApiDump, deps: PersistDeps): Promise<void> {
  const events = parseExpedition(dump) ?? [];
  if (!events.length) return;
  for (const e of events as AnyEvt[]) {
    const pe = toPersist(e);
    if (pe) {
      await persistEvent(pe, deps);
    }
  }
}