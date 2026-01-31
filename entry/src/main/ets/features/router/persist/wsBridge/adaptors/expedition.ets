import type { AnyMsg, BaseMsg } from '../../../../../infra/net/wsClient/types';
import type { ExpeditionReady } from '../../../../../infra/net/wsClient/types';
import type { HandlerEvent ,MsgAdapter, PersistEventIdMaker,ExpeditionEventPayload  } from '../../type';
import { ExpeditionProgress, type ExpeditionSlotState } from '../../../../../domain/models';

//guard
export interface ExpeditionReadyMsg extends BaseMsg<ExpeditionReady> {
  ch: 'expedition';
}

function checkExpeditionReady(msg: AnyMsg): boolean {
  const base: BaseMsg<ExpeditionReady> = msg as BaseMsg<ExpeditionReady>;
  if (base == null) return false;
  if (base.ch !== 'expedition') return false;
  const p: ExpeditionReady = base.payload;
  if (p == null) return false;
  const okIds: boolean = typeof p.fleetId === 'number' && typeof p.expeditionId === 'number';
  const okRemain: boolean = typeof p.remainMs === 'number';
  return okIds && okRemain;
}

function toSlotState(m: ExpeditionReadyMsg): ExpeditionSlotState {
  const serverTs: number = m.ts != null ? m.ts : Date.now();
  const rt: number = m.payload.remainMs > 0 ? (serverTs + m.payload.remainMs) : 0;
  const prog: ExpeditionProgress =
    m.payload.remainMs > 0 ? ExpeditionProgress.RUNNING : ExpeditionProgress.RETURNABLE;

  return {
    deckId: m.payload.fleetId | 0,
    missionId: m.payload.expeditionId | 0,
    progress: prog,
    returnTime: rt | 0,
    updatedAt: serverTs | 0,
  };
}

export class ExpeditionAdapter implements MsgAdapter {
  readonly channel = 'expedition';

  canHandle(msg: AnyMsg): boolean {
    return checkExpeditionReady(msg);
  }

  toPersistEvents(msg: AnyMsg, idMaker: PersistEventIdMaker): HandlerEvent[] {
    const m: ExpeditionReadyMsg = msg as ExpeditionReadyMsg;
    const slot: ExpeditionSlotState = toSlotState(m);
    const ts: number = m.ts != null ? m.ts : Date.now();
    const id: string = idMaker.makeId('exp-slot', slot.deckId, slot.missionId, ts);

    const payload: ExpeditionEventPayload = { kind: 'slotState', data: slot };

    const ev: HandlerEvent = {
      id: id,
      type: 'EXPEDITION',
      timestamp: ts,
      source: 'web',
      schemaVersion: 1,
      payload: payload,
    };

    return [ev];
  }
}