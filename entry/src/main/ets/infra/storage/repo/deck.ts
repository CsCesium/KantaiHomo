import { DeckRepository, DeckRowWrite, DeckRow } from './types';

type DaoModule = typeof import('../dao/deck');
type DbRow = import('../dao/deck').DeckDbRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/deck');
  return _dao;
}

function safeParseNumArray(json: string): number[] {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    const out: number[] = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
      const n = v[i];
      out[i] = (typeof n === 'number' && Number.isFinite(n)) ? n : -1;
    }
    return out;
  } catch {
    return [];
  }
}

export class DeckRepositoryDb implements DeckRepository {
  async upsertBatch(rows: ReadonlyArray<DeckRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();
    const mapped: DbRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      mapped.push({
        deckId: r.deckId,
        name: r.name ?? '',
        shipUidsJson: JSON.stringify(Array.isArray(r.shipUids) ? r.shipUids : []),

        expeditionProgress: r.expeditionProgress ?? 0,
        expeditionMissionId: r.expeditionMissionId ?? 0,
        expeditionReturnTime: r.expeditionReturnTime ?? 0,
        expeditionUpdatedAt: r.expeditionUpdatedAt ?? (r.updatedAt ?? now),

        updatedAt: r.updatedAt ?? now,
      });
    }

    await Dao.upsertBatch(mapped);
  }

  async list(): Promise<ReadonlyArray<DeckRow>> {
    const Dao = await loadDao();
    const rows = await Dao.listDecks();
    return rows.map((r) => ({
      deckId: r.deckId,
      name: r.name,
      shipUids: safeParseNumArray(r.shipUidsJson),

      expeditionProgress: r.expeditionProgress,
      expeditionMissionId: r.expeditionMissionId,
      expeditionReturnTime: r.expeditionReturnTime,
      expeditionUpdatedAt: r.expeditionUpdatedAt,

      updatedAt: r.updatedAt,
    }));
  }

  async get(deckId: number): Promise<DeckRow | null> {
    const Dao = await loadDao();
    const r = await Dao.getDeck(deckId);
    if (!r) return null;
    return {
      deckId: r.deckId,
      name: r.name,
      shipUids: safeParseNumArray(r.shipUidsJson),

      expeditionProgress: r.expeditionProgress,
      expeditionMissionId: r.expeditionMissionId,
      expeditionReturnTime: r.expeditionReturnTime,
      expeditionUpdatedAt: r.expeditionUpdatedAt,

      updatedAt: r.updatedAt,
    };
  }
}