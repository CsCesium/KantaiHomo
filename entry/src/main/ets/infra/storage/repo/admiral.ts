import { AdmiralRepository, AdmiralRow, AdmiralRowWrite } from './types';

type DaoModule = typeof import('../dao/admiral');
type DbRow = import('../dao/admiral').AdmiralRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/admiral');
  return _dao;
}

export class AdmiralRepositoryDb implements AdmiralRepository {
  async upsert(row: AdmiralRowWrite): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();

    const mapped: DbRow = {
      memberId: row.memberId,
      nickname: row.nickname,
      level: row.level,
      experience: row.experience,
      maxShips: row.maxShips,
      maxSlotItems: row.maxSlotItems,
      rank: typeof row.rank === 'number' ? row.rank : null,
      largeDockEnabled:
      typeof row.largeDockEnabled === 'boolean' ? (row.largeDockEnabled ? 1 : 0) : null,
      updatedAt: row.updatedAt ?? now,
    };

    await Dao.upsert(mapped);
  }

  async get(memberId: number): Promise<AdmiralRow | null> {
    const Dao = await loadDao();
    const r = await Dao.getAdmiral(memberId);
    if (!r) return null;
    return {
      memberId: r.memberId,
      nickname: r.nickname,
      level: r.level,
      experience: r.experience,
      maxShips: r.maxShips,
      maxSlotItems: r.maxSlotItems,
      rank: (typeof r.rank === 'number') ? r.rank : undefined,
      largeDockEnabled:
      (typeof r.largeDockEnabled === 'number') ? (r.largeDockEnabled === 1) : undefined,
      updatedAt: r.updatedAt,
    };
  }

  async getLatest(): Promise<AdmiralRow | null> {
    const Dao = await loadDao();
    const r = await Dao.getLatestAdmiral();
    if (!r) return null;
    return {
      memberId: r.memberId,
      nickname: r.nickname,
      level: r.level,
      experience: r.experience,
      maxShips: r.maxShips,
      maxSlotItems: r.maxSlotItems,
      rank: (typeof r.rank === 'number') ? r.rank : undefined,
      largeDockEnabled:
      (typeof r.largeDockEnabled === 'number') ? (r.largeDockEnabled === 1) : undefined,
      updatedAt: r.updatedAt,
    };
  }
}