//only for dev
//in-memory
import { ExpeditionRowWrite, ExpeditionsDAO, PersistDeps, RecentIdCache } from "../features/router/persist/type";

class MemRecent implements RecentIdCache {
  private set = new Set<string>();
  private limit: number;

  constructor(limit = 2000) {
  this.limit = limit;
}
  has(id: string): boolean { return this.set.has(id); }
  add(id: string): void {
    this.set.add(id);
    if (this.set.size > this.limit) {
      const it = this.set.values().next();
      if (!it.done) this.set.delete(it.value);
    }
  }
}

class MemExpeditionDAO implements ExpeditionsDAO {
  private data = new Map<string, ExpeditionRowWrite>(); // key: `${deckId}:${missionId}`
  async upsertBatch(rows: ExpeditionRowWrite[]): Promise<void> {
    for (const r of rows) this.data.set(`${r.deckId}:${r.missionId}`, r);
    console.info('[DAO][EXPEDITION] upsert', rows.length);
  }
}

let _deps: PersistDeps | null = null;

export function setPersistDeps(d: PersistDeps) { _deps = d; }
export function getPersistDeps(): PersistDeps | null { return _deps; }
export function resetPersistDeps(): void { _deps = null; }

interface tempDeps {
  dao?: ExpeditionsDAO;
  recent?: RecentIdCache;
}

export function initPersistDeps(opts?: tempDeps) {
  if (_deps) return;
  const dao = opts?.dao ?? new MemExpeditionDAO();
  const recent = opts?.recent ?? new MemRecent(2000);
  setPersistDeps({ daos: { EXPEDITION: dao }, recentIdCache: recent });
}