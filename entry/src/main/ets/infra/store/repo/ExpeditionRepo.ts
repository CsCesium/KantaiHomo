import type { ExpeditionRepository, ExpeditionRowWrite, ExpeditionRow } from './types';
import * as DbExp from '../dao/ExpeditionsDao';

export class ExpeditionRepositoryDb implements ExpeditionRepository {
  async upsertBatch(rows: ReadonlyArray<ExpeditionRowWrite>): Promise<void> {
    // 映射
    const mapped = new Array<DbExp.ExpeditionRow>();
    const now = Date.now();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const returnTime =
        (typeof r.finishedAt === 'number' && r.finishedAt > 0) ? r.finishedAt :
          (typeof r.eta === 'number' && r.eta > 0) ? r.eta : 0;

      const progress =
        (typeof r.finishedAt === 'number' && r.finishedAt > 0) ? 2 :
          (typeof r.eta === 'number' && r.eta > 0) ? 1 : 0;

      mapped.push({
        deckId: r.deckId,
        missionId: r.missionId,
        progress: progress,
        returnTime: returnTime,
        updatedAt: r.updatedAt ?? now
      });
    }
    await DbExp.upsertBatch(mapped);
  }

  async list(): Promise<ReadonlyArray<ExpeditionRow>> {
    return await DbExp.listExpeditions();
  }

  async getNextAfter(nowMs: number): Promise<{ deckId: number; missionId: number; returnTime: number } | null> {
    return await DbExp.getNextExpeditionAfter(nowMs);
  }
}