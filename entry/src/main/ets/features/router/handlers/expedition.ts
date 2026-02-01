import { AnyExpEvt } from '../../../domain/events';
import { MissionStart, ExpeditionProgress, ExpeditionSlotState, MissionResult } from '../../../domain/models';
import { ExpeditionRow } from '../../../infra/storage/types';
import { i32, i64 } from '../../../infra/utils/num';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class ExpeditionHandler implements Handler{
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyExpEvt;

    if (!deps.repos?.expedition) {
      console.warn('[persist][EXPEDITION] repository not provided');
      return;
    }

    const ts = ev.timestamp ?? Date.now();

    switch (e.type) {
      case 'EXPEDITION_START':
        await this.handleStart(e.payload, ts, deps);
        break;
      case 'EXPEDITION_UPDATE':
        await this.handleUpdate(e.payload, ts, deps);
        break;
      case 'EXPEDITION_RESULT':
        await this.handleResult(e.payload, ts, deps);
        break;
      case 'EXPEDITION_CATALOG':
        // catalog 不写表
        break;
    }
  }
  private async handleStart(payload: MissionStart, ts: number, deps: PersistDeps) {
    const row: ExpeditionRow = {
      deckId: i32(payload.deckId, 0),
      missionId: i32(payload.missionId, 0),
      progress: ExpeditionProgress.RUNNING,
      returnTime: i64(payload.complTime, 0),
      updatedAt: i64(payload.updatedAt ?? ts, ts),
    };
    await deps.repos!.expedition.upsertBatch([row]);
  }

  private async handleUpdate(payload: ExpeditionSlotState[], ts: number, deps: PersistDeps) {
    const rows: ExpeditionRow[] = payload.map(s => ({
      deckId: i32(s.deckId, 0),
      missionId: i32(s.missionId, 0),
      progress: i32(s.progress, 0),
      returnTime: i64(s.returnTime, 0),
      updatedAt: i64(s.updatedAt ?? ts, ts),
    }));
    await deps.repos!.expedition.upsertBatch(rows);
  }

  private async handleResult(payload: MissionResult, ts: number, deps: PersistDeps) {
    const row: ExpeditionRow = {
      deckId: i32(payload.deckId, 0),
      missionId: i32(payload.missionId, 0),
      progress: ExpeditionProgress.IDLE,
      returnTime: 0,
      updatedAt: i64(payload.finishedAt ?? ts, ts),
    };
    await deps.repos!.expedition.upsertBatch([row]);
  }
}
const handler = new ExpeditionHandler();
registerHandler('EXPEDITION_START', handler);
registerHandler('EXPEDITION_UPDATE', handler);
registerHandler('EXPEDITION_RESULT', handler);
registerHandler('EXPEDITION_CATALOG', handler);