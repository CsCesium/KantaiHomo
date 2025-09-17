import type { ApiDump } from '../../infra/web/types';
import { parseExpedition } from './expedition';
import type {
  ExpeditionStartEvent,
  ExpeditionUpdateEvent,
  ExpeditionResultEvent,
  ExpeditionCatalogEvent
} from '../../domain/events/expedition';

export type AnyEvent =
  | ExpeditionStartEvent
    | ExpeditionUpdateEvent
    | ExpeditionResultEvent
    | ExpeditionCatalogEvent;

export function parseAll(dump: ApiDump): AnyEvent[] {
  const out: AnyEvent[] = [];
  const ex = parseExpedition(dump);
  if (ex && ex.length) out.push(...ex);
  //TODO:expend feature
  return out;
}