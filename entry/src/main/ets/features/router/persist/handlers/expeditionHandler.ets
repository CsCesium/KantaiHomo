//entry/src/main/ets/features/router/persist/handlers/expeditionHandler.ets
import { registerPersistHandler } from '..';
import type {
  PersistDeps,
  PersistEvent,
  PersistHandler,
  ExpeditionEventPayload,
} from '../type';
import {PersistEventExpedition} from '../type'



import type { ExpeditionRowWrite as RepoRowWrite } from '../../../../infra/storage/repo/types';
import {  i64,i32 } from '../../../../infra/utils/num';
import { ExpeditionSlotState, MissionStart, ExpeditionProgress, MissionResult } from '../../../../domain/models/struct';

function isExpeditionEvent(ev: PersistEvent): boolean {
  return ev.type === 'EXPEDITION';
}

export interface ExpeditionRowLite {
  deckId: number;
  missionId: number;
  progress: number;   // 0/1/2
  returnTime: number; // 预计返还时间戳（ms），RESULT 时通常为 0
  updatedAt: number;  // 事件时间戳（或 finishedAt）
}

function mapFromSlotState(
  data: ExpeditionSlotState | ExpeditionSlotState[],
  fallbackTs: number
): ExpeditionRowLite[] {
  const rows: ExpeditionRowLite[] = []
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const s: ExpeditionSlotState = data[i]
      rows.push({
        deckId: i32(s.deckId, 0),
        missionId: i32(s.missionId, 0),
        progress: i32(s.progress, 0),
        returnTime: i64(s.returnTime, 0), // ✅ 不要 |0
        updatedAt: i64((s.updatedAt != null ? s.updatedAt : fallbackTs), fallbackTs),
      })
    }
  } else {
    rows.push({
      deckId: i32(data.deckId, 0),
      missionId: i32(data.missionId, 0),
      progress: i32(data.progress, 0),
      returnTime: i64(data.returnTime, 0),
      updatedAt: i64((data.updatedAt != null ? data.updatedAt : fallbackTs), fallbackTs),
    })
  }
  return rows
}

function mapFromStart(data: MissionStart, fallbackTs: number): ExpeditionRowLite[] {
  return [{
    deckId: i32(data.deckId, 0),
    missionId: i32(data.missionId, 0),
    progress: ExpeditionProgress.RUNNING,
    returnTime: i64(data.complTime, 0), // ✅
    updatedAt: i64((data.updatedAt != null ? data.updatedAt : fallbackTs), fallbackTs),
  }]
}

function mapFromResult(data: MissionResult, fallbackTs: number): ExpeditionRowLite[] {
  return [{
    deckId: i32(data.deckId, 0),
    missionId: i32(data.missionId, 0),
    progress: ExpeditionProgress.IDLE,
    returnTime: 0,
    updatedAt: i64((data.finishedAt != null ? data.finishedAt : fallbackTs), fallbackTs),
  }]
}

class ExpeditionPersistHandler implements PersistHandler {
  async handle(ev: PersistEvent, deps: PersistDeps): Promise<void> {
    if (!isExpeditionEvent(ev)) return;
    const e: PersistEventExpedition = ev as PersistEventExpedition;

    if (!deps.repos || !deps.repos.expedition) {
      console.warn('[persist][EXPEDITION] repository not provided');
      return;
    }

    const ts: number = (e.timestamp != null ? e.timestamp : Date.now());
    const p: ExpeditionEventPayload = e.payload;

    // 1) mapping -> Lite
    let rowsLite: ExpeditionRowLite[] = [];
    if (p.kind === 'slotState') {
      rowsLite = mapFromSlotState(p.data as ExpeditionSlotState | ExpeditionSlotState[], ts);
    } else if (p.kind === 'start') {
      rowsLite = mapFromStart(p.data as MissionStart, ts);
    } else if (p.kind === 'result') {
      rowsLite = mapFromResult(p.data as MissionResult, ts);
    } else {
      rowsLite = []; // catalog 不写 expeditions 表
    }
    if (rowsLite.length === 0) return;

    // 2) Lite -> 仓储模型
    const rowsRepo: RepoRowWrite[] = [];
    for (let i = 0; i < rowsLite.length; i++) {
      const r: ExpeditionRowLite = rowsLite[i];
      if (p.kind === 'result') {
        rowsRepo.push({
          deckId: r.deckId,
          missionId: r.missionId,
          finishedAt: r.updatedAt,
          updatedAt: r.updatedAt
        });
      } else {
        rowsRepo.push({
          deckId: r.deckId,
          missionId: r.missionId,
          eta: r.returnTime,
          updatedAt: r.updatedAt
        });
      }
    }

    await deps.repos.expedition.upsertBatch(rowsRepo);
  }
}

registerPersistHandler('EXPEDITION', new ExpeditionPersistHandler());
