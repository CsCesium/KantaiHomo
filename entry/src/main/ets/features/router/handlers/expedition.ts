import { AnyExpEvt } from '../../../domain/events';
import { MissionStart, ExpeditionProgress, ExpeditionSlotState, MissionResult } from '../../../domain/models';
import { ExpeditionRow, ExpeditionResultRow } from '../../../infra/storage/types';
import { i32, i64 } from '../../../infra/utils/num';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';
import { cacheMissionNames } from '../../../features/alerts/module/missionCache';
import { triggerExpeditionChanged } from '../../../features/alerts/module/expeditionTrigger';

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
        cacheMissionNames((e.payload as { id: number; name: string }[]).map(m => ({ id: m.id, name: m.name })));
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
    triggerExpeditionChanged();
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
    triggerExpeditionChanged();
  }

  private async handleResult(payload: MissionResult, ts: number, deps: PersistDeps) {
    const finishedAt = i64(payload.finishedAt ?? ts, ts);
    const stateRow: ExpeditionRow = {
      deckId: i32(payload.deckId, 0),
      missionId: i32(payload.missionId, 0),
      progress: ExpeditionProgress.IDLE,
      returnTime: 0,
      updatedAt: finishedAt,
    };
    await deps.repos!.expedition.upsertBatch([stateRow]);

    try {
      const resultRow: ExpeditionResultRow = {
        deckId: i32(payload.deckId, 0),
        missionId: i32(payload.missionId, 0),
        clear: payload.clear,
        admiral_lv: payload.admiral?.lv ?? null,
        admiral_getExp: payload.admiral?.getExp ?? null,
        materials: payload.drops.materials ? JSON.stringify(payload.drops.materials) : null,
        items: payload.drops.items?.length
          ? JSON.stringify(payload.drops.items.map(it => ({ id: it.id, count: it.count })))
          : null,
        finishedAt,
      };
      await deps.repos!.expeditionResult.insert(resultRow);
    } catch (e) {
      console.warn('[persist][EXPEDITION] result insert failed:', e);
    }

    triggerExpeditionChanged();
  }
}
const handler = new ExpeditionHandler();
registerHandler('EXPEDITION_START', handler);
registerHandler('EXPEDITION_UPDATE', handler);
registerHandler('EXPEDITION_RESULT', handler);
registerHandler('EXPEDITION_CATALOG', handler);