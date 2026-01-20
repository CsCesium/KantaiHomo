//src/main/ets/infra/storage/repo/expedition.ts
import type { ExpeditionRepository, ExpeditionRowWrite, ExpeditionRow } from './types';

type DaoModule = typeof import('../dao/expeditions');
type DbRow = import('../dao/expeditions').ExpeditionRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/expeditions');
  return _dao;
}

export class ExpeditionRepositoryDb implements ExpeditionRepository {
  async upsertBatch(rows: ReadonlyArray<ExpeditionRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const mapped: Array<DbRow> = [];
    const now: number = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const returnTime: number =
        (typeof r.finishedAt === 'number' && r.finishedAt > 0) ? r.finishedAt :
          (typeof r.eta === 'number' && r.eta > 0) ? r.eta : 0;

      const progress: number =
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
    await Dao.upsertBatch(mapped);
  }

  async list(): Promise<ReadonlyArray<ExpeditionRow>> {
    const Dao = await loadDao();
    return await Dao.listExpeditions();
  }

  async getNextAfter(nowMs: number): Promise<{ deckId: number; missionId: number; returnTime: number } | null> {
    const Dao = await loadDao();
    return await Dao.getNextExpeditionAfter(nowMs);
  }
}
