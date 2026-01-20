import relationalStore from '@ohos.data.relationalStore';

export interface Tx {
  store: relationalStore.RdbStore;
}

export interface UnitOfWork {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/*---------------- admiral -------------------*/
export interface AdmiralRow {
  memberId: number;
  nickname: string;
  level: number;
  experience: number;
  maxShips: number;
  maxSlotItems: number;
  rank?: number;
  largeDockEnabled?: boolean;
  updatedAt: number;
}

export type AdmiralRowWrite = Omit<AdmiralRow, never>;

export interface AdmiralRepository {
  upsert(row: AdmiralRowWrite): Promise<void>;
  get(memberId: number): Promise<AdmiralRow | null>;
  getLatest(): Promise<AdmiralRow | null>;
}
/*---------------- materials -------------------*/
export interface MaterialsRow {
  memberId: number;
  fuel: number;
  ammo: number;
  steel: number;
  bauxite: number;
  instantBuild: number;
  instantRepair: number;
  devMaterial: number;
  screw: number;
  updatedAt: number;
}

export type MaterialsRowWrite = Omit<MaterialsRow, 'memberId'>;

export interface MaterialsRepository {
  upsert(row: MaterialsRowWrite, memberId?: number): Promise<void>;
  get(memberId?: number): Promise<MaterialsRow | null>;
  getLatest(): Promise<MaterialsRow | null>;
}
/*---------------- expedition -------------------*/

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
  admiral:AdmiralRepository;

}