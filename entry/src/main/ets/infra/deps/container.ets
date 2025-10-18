//@src/main/ets/features/deps/container.ets
import { expeditionRdbDAO } from "../../features/router/persist/adaptors/rdb/expedition";
import { PersistDeps, RecentIdCache } from "../../features/router/persist/type";

let _deps: PersistDeps | null = null;

export function setPersistDeps(d: PersistDeps): void {
  _deps = d;
}

export function getPersistDeps(): PersistDeps | null {
  return _deps;
}

export function ensurePersistDeps(): PersistDeps {
  if (_deps === null) {
    throw new Error('[persist] deps not initialized');
  }
  return _deps as PersistDeps;
}

export class RecentIdCacheImpl implements RecentIdCache {
  private readonly limit: number;
  private readonly set: Set<string> = new Set<string>();

  constructor(limit: number = 4000) {
    this.limit = limit;
  }

  has(id: string): boolean {
    return this.set.has(id);
  }

  add(id: string): void {
    this.set.add(id);
    if (this.set.size > this.limit) {
      const it = this.set.values();
      const first = it.next();
      if (!first.done) {
        this.set.delete(first.value);
      }
    }
  }
}

export function makeRecentIdCache(limit: number = 4000): RecentIdCache {
  return new RecentIdCacheImpl(limit);
}

/** PROD：real RDB DAO；WS(WIP) */
export function initPersistDepsProd(): void {
  if (_deps !== null) return;
  _deps = {
    daos: { EXPEDITION: expeditionRdbDAO },
    recentIdCache: makeRecentIdCache(4000),
  } as PersistDeps;
}