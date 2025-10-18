import { createRepositoryHub } from "../store/repo";
import { RepositoryHub } from "../store/repo/types";

export interface RecentIdCache {
  has(id: string): boolean;
  add(id: string): void;
}
class MemRecent implements RecentIdCache {
  private set: Set<string> = new Set<string>();
  private limit: number;
  constructor(limit: number = 2000) { this.limit = limit; }
  has(id: string): boolean { return this.set.has(id); }
  add(id: string): void {
    this.set.add(id);
    if (this.set.size > this.limit) {
      const it = this.set.values().next();
      if (!it.done) this.set.delete(it.value);
    }
  }
}

// v2：统一上下文
export interface PersistDeps {
  repos: RepositoryHub;
  recentIdCache: RecentIdCache;
  publish?: (topic: string, data: object) => void;
  kvSet?: (key: string, value: string) => Promise<void>;
}

let _deps: PersistDeps | null = null;

export interface InitDepsOptions {
  repos?: RepositoryHub;
  recent?: RecentIdCache;
  publish?: (topic: string, data: object) => void;
  kvSet?: (key: string, value: string) => Promise<void>;
}

export function initPersistDeps(opts?: InitDepsOptions): void {
  if (_deps !== null) return;
  const repos: RepositoryHub = opts && opts.repos ? opts.repos : createRepositoryHub();
  const recent: RecentIdCache = opts && opts.recent ? opts.recent : new MemRecent(2000);
  _deps = { repos, recentIdCache: recent, publish: opts?.publish, kvSet: opts?.kvSet };
}

export function setPersistDeps(d: PersistDeps): void { _deps = d; }
export function getPersistDeps(): PersistDeps | null { return _deps; }
export function resetPersistDeps(): void { _deps = null; }