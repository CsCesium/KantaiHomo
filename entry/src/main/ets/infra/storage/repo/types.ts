import relationalStore from '@ohos.data.relationalStore';

export interface Tx {
  store: relationalStore.RdbStore;
}

export interface UnitOfWork {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

// Expedition
export interface ExpeditionRowWrite {
  deckId: number;
  missionId: number;
  eta?: number;
  finishedAt?: number;
  updatedAt?: number;
}
export interface ExpeditionRow {
  deckId: number;
  missionId: number;
  progress: number;
  returnTime: number;
  updatedAt: number;
}


export interface ExpeditionRepository {
  upsertBatch(rows: ReadonlyArray<ExpeditionRowWrite>): Promise<void>;
  list(): Promise<ReadonlyArray<ExpeditionRow>>;
  getNextAfter(nowMs: number): Promise<{ deckId: number; missionId: number; returnTime: number } | null>;
}

export interface RepositoryHub {
  expedition: ExpeditionRepository;
}