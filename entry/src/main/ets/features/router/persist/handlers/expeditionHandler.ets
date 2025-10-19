import { registerPersistHandler } from '..';
import type {
  PersistDeps,
  PersistEvent,
  PersistHandler,
  ExpeditionEventPayload,
} from '../type';

import {
  ExpeditionProgress,
  type MissionStart,
  type ExpeditionSlotState,
  type MissionResult,
} from '../../../../domain/models/expedition';
import type { ExpeditionRowWrite as RepoRowWrite } from '../../../../infra/store/repo/types';

export interface ExpeditionPersistEvent {
  id: string;
  type: 'EXPEDITION';
  timestamp: number;
  source: 'web' | 'vpn' | 'companion';
  raw?: string;
  schemaVersion?: number;
  endpoint?: string;
  payload: ExpeditionEventPayload;
}

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

function mapFromSlotState(data: ExpeditionSlotState | ExpeditionSlotState[], fallbackTs: number): ExpeditionRowLite[] {
  const rows: ExpeditionRowLite[] = [];
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const s: ExpeditionSlotState = data[i];
      rows.push({
        deckId: (s.deckId | 0),
        missionId: (s.missionId | 0),
        progress: (s.progress | 0),
        returnTime: (s.returnTime | 0),
        updatedAt: ((s.updatedAt != null ? s.updatedAt : fallbackTs) | 0)
      });
    }
  } else {
    rows.push({
      deckId: (data.deckId | 0),
      missionId: (data.missionId | 0),
      progress: (data.progress | 0),
      returnTime: (data.returnTime | 0),
      updatedAt: ((data.updatedAt != null ? data.updatedAt : fallbackTs) | 0)
    });
  }
  return rows;
}

function mapFromStart(data: MissionStart, fallbackTs: number): ExpeditionRowLite[] {
  return [{
    deckId: (data.deckId | 0),
    missionId: (data.missionId | 0),
    progress: ExpeditionProgress.RUNNING,
    returnTime: (data.complTime | 0),
    updatedAt: ((data.updatedAt != null ? data.updatedAt : fallbackTs) | 0),
  }];
}

function mapFromResult(data: MissionResult, fallbackTs: number): ExpeditionRowLite[] {
  return [{
    deckId: (data.deckId | 0),
    missionId: (data.missionId | 0),
    progress: ExpeditionProgress.IDLE,
    returnTime: 0,
    updatedAt: ((data.finishedAt != null ? data.finishedAt : fallbackTs) | 0), // 用作 finishedAt
  }];
}

const handler: PersistHandler = async (ev: PersistEvent, deps: PersistDeps): Promise<void> => {
  if (!isExpeditionEvent(ev)) return;
  const e: ExpeditionPersistEvent = ev as ExpeditionPersistEvent;

  if (!deps.repos || !deps.repos.expedition) {
    console.warn('[persist][EXPEDITION] repository not provided');
    return;
  }

  const ts: number = (e.timestamp != null ? e.timestamp : Date.now());
  const p: ExpeditionEventPayload = e.payload;

  // 1) mapping
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

  // 2) Lite 行转换为仓储模型：
  //    - start/slotState：写 eta = returnTime
  //    - result：写 finishedAt = updatedAt
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
};

registerPersistHandler('EXPEDITION', handler);