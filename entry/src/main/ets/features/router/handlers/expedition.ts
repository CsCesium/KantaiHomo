import { ExpeditionStartEvent, ExpeditionUpdateEvent, ExpeditionResultEvent } from '../../../domain/events';
import { ExpeditionSlotState, MissionStart, MissionResult, ExpeditionProgress } from '../../../domain/models';
import { ExpeditionRow } from '../../../infra/storage/types';
import { i32, i64 } from '../../../infra/utils/num';
import { registerPersistHandler } from '../persist';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';


// ========== 类型守卫 ==========
function isExpeditionStart(ev: HandlerEvent): ev is ExpeditionStartEvent {
  return ev.type === 'EXPEDITION_START';
}
function isExpeditionUpdate(ev: HandlerEvent): ev is ExpeditionUpdateEvent {
  return ev.type === 'EXPEDITION_UPDATE';
}
function isExpeditionResult(ev: HandlerEvent): ev is ExpeditionResultEvent {
  return ev.type === 'EXPEDITION_RESULT';
}

// ========== Mapper: Domain → Row ==========
function mapFromSlotState(data: ExpeditionSlotState[], fallbackTs: number): ExpeditionRow[] {
  return data.map(s => ({
    deckId: i32(s.deckId, 0),
    missionId: i32(s.missionId, 0),
    progress: i32(s.progress, 0),
    returnTime: i64(s.returnTime, 0),
    updatedAt: i64(s.updatedAt ?? fallbackTs, fallbackTs),
  }));
}

function mapFromStart(data: MissionStart, fallbackTs: number): ExpeditionRow[] {
  return [{
    deckId: i32(data.deckId, 0),
    missionId: i32(data.missionId, 0),
    progress: ExpeditionProgress.RUNNING,
    returnTime: i64(data.complTime, 0),
    updatedAt: i64(data.updatedAt ?? fallbackTs, fallbackTs),
  }];
}

function mapFromResult(data: MissionResult, fallbackTs: number): ExpeditionRow[] {
  return [{
    deckId: i32(data.deckId, 0),
    missionId: i32(data.missionId, 0),
    progress: ExpeditionProgress.IDLE,
    returnTime: 0,
    updatedAt: i64(data.finishedAt ?? fallbackTs, fallbackTs),
  }];
}

// ========== Handler ==========
class ExpeditionPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    if (!deps.repos?.expedition) {
      console.warn('[persist][EXPEDITION] repository not provided');
      return;
    }

    const ts = ev.timestamp ?? Date.now();
    let rows: ExpeditionRow[] = [];

    // 直接 switch ev.type
    if (isExpeditionStart(ev)) {
      rows = mapFromStart(ev.payload, ts);
    } else if (isExpeditionUpdate(ev)) {
      rows = mapFromSlotState(ev.payload, ts);
    } else if (isExpeditionResult(ev)) {
      rows = mapFromResult(ev.payload, ts);
    } else {
      return;
    }

    if (rows.length > 0) {
      await deps.repos.expedition.upsertBatch(rows);
    }
  }
}

const handler = new ExpeditionPersistHandler();
registerPersistHandler('EXPEDITION_START', handler);
registerPersistHandler('EXPEDITION_UPDATE', handler);
registerPersistHandler('EXPEDITION_RESULT', handler);
registerPersistHandler('EXPEDITION_CATALOG', handler);