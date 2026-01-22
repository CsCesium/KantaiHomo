import relationalStore from '@ohos.data.relationalStore';

export interface Tx {
  store: relationalStore.RdbStore;
}

export interface UnitOfWork {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/**---------------- Admiral -------------------*/
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
/**---------------- Materials -------------------*/
export interface MaterialsRow {
  id: number; // KEY
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

export type MaterialsRowWrite = Omit<MaterialsRow, 'id'>;

export interface MaterialsRepository {
  append(row: MaterialsRowWrite): Promise<void>;

  appendIfChanged(row: MaterialsRowWrite): Promise<boolean>; // true=写入了

  getLatest(): Promise<MaterialsRow | null>;

  listBetween(startMs: number, endMs: number, limit?: number): Promise<ReadonlyArray<MaterialsRow>>;

  listLatest(limit: number): Promise<ReadonlyArray<MaterialsRow>>;
}
/**---------------- SlotItem Master -------------------*/

export interface SlotItemMasterRow {
  id: number;
  sortNo: number;
  name: string;

  typeMajor: number;
  typeBook: number;
  typeEquipType: number;
  typeIconId: number;
  typeAircraft: number;

  rarity: number;
  range: number;

  stat_hp: number;
  stat_armor: number;
  stat_firepower: number;
  stat_torpedo: number;
  stat_speed: number;
  stat_bomb: number;
  stat_aa: number;
  stat_asw: number;
  stat_hit: number;
  stat_evasion: number;
  stat_los: number;
  stat_luck: number;

  broken_fuel: number;
  broken_ammo: number;
  broken_steel: number;
  broken_bauxite: number;

  cost?: number;
  distance?: number;
  useBull?: number;
  gfxVersion?: number;

  updatedAt: number;
}
export type SlotItemMasterRowWrite = Omit<SlotItemMasterRow, never>;

// ------- SlotItem instance -------

export interface SlotItemRow {
  uid: number;
  masterId: number;
  locked: boolean;
  level?: number;
  alv?: number;
  updatedAt: number;
}

export type SlotItemRowWrite = Omit<SlotItemRow, never>;
export interface SlotItemWithMaster {
  item: SlotItemRow;
  master: SlotItemMasterRow | null;
}

export interface SlotItemRepository {
  upsertMasterBatch(rows: ReadonlyArray<SlotItemMasterRowWrite>): Promise<void>;
  upsertBatch(rows: ReadonlyArray<SlotItemRowWrite>): Promise<void>;

  getWithMaster(uid: number): Promise<SlotItemWithMaster | null>;
  listWithMaster(): Promise<ReadonlyArray<SlotItemWithMaster>>;

  listWithMasterByUids(uids: ReadonlyArray<number>): Promise<ReadonlyArray<SlotItemWithMaster>>;
}

/**---------------- Ship -------------------*/
export interface ShipMasterRow {
  id: number;        // api_id
  sortNo: number;    // api_sortno
  name: string;      // api_name

  stype?: number;    // api_stype（舰种）
  ctype?: number;    // api_ctype（舰型）
  speed?: number;    // api_soku
  range?: number;    // api_leng
  slotNum?: number;  // api_slot_num

  maxEqJson?: string; // JSON number[]

  afterLv?: number;     // api_afterlv
  afterShipId?: number; // api_aftershipid

  updatedAt: number;
}

export type ShipMasterRowWrite = Omit<ShipMasterRow, never>;
export interface ShipRow {
  uid: number;      // api_id
  sortNo: number;   // api_sortno
  masterId: number; // api_ship_id

  level: number;    // api_lv
  expTotal: number; // api_exp[0]
  expToNext: number;// api_exp[1]
  expGauge: number; // api_exp[2]

  nowHp: number;    // api_nowhp
  maxHp: number;    // api_maxhp
  speed: number;    // api_soku
  range: number;    // api_leng

  slotsJson: string;  // JSON EquipSlots
  onslotJson: string; // JSON number[]
  slotEx: number;     // api_slot_ex

  // modernization tuple api_kyouka
  modern_fp: number;
  modern_tp: number;
  modern_aa: number;
  modern_ar: number;
  modern_luck: number;
  modern_hp: number;
  modern_asw: number;

  backs: number;     // api_backs
  fuel: number;      // api_fuel
  bull: number;      // api_bull
  slotnum: number;   // api_slotnum

  ndockTime: number;     // api_ndock_time
  ndockFuel: number;     // api_ndock_item[0]
  ndockSteel: number;    // api_ndock_item[1]

  srate: number;     // api_srate
  cond: number;      // api_cond

  // stat pairs: current/max
  fp_cur: number; fp_max: number;       // api_karyoku
  tp_cur: number; tp_max: number;       // api_raisou
  aa_cur: number; aa_max: number;       // api_taiku
  ar_cur: number; ar_max: number;       // api_soukou
  ev_cur: number; ev_max: number;       // api_kaihi
  asw_cur: number; asw_max: number;     // api_taisen
  sc_cur: number; sc_max: number;       // api_sakuteki
  luck_cur: number; luck_max: number;   // api_lucky

  locked: boolean;      // api_locked
  lockedEquip: boolean; // api_locked_equip
  sallyArea?: number;   // api_sally_area

  updatedAt: number;
}

export type ShipRowWrite = Omit<ShipRow, never>;

export interface ShipWithMaster {
  ship: ShipRow;
  master: ShipMasterRow | null;
}

export interface ShipRepository {
  upsertMasterBatch(rows: ReadonlyArray<ShipMasterRowWrite>): Promise<void>;
  upsertBatch(rows: ReadonlyArray<ShipRowWrite>): Promise<void>;

  getWithMaster(uid: number): Promise<ShipWithMaster | null>;
  listWithMaster(): Promise<ReadonlyArray<ShipWithMaster>>;
}
/**---------------- Deck -------------------*/
export interface DeckRow {
  deckId: number;
  name: string;
  shipUids: number[]; // 业务层用数组

  // expedition 展开（存储时不含 deckId）
  expeditionProgress: number; // ExpeditionProgress
  expeditionMissionId: number;
  expeditionReturnTime: number;
  expeditionUpdatedAt: number;

  updatedAt: number;
}
export type DeckRowWrite = DeckRow;

export interface DeckRepository {
  upsertBatch(rows: ReadonlyArray<DeckRowWrite>): Promise<void>;
  list(): Promise<ReadonlyArray<DeckRow>>;
  get(deckId: number): Promise<DeckRow | null>;
}
/**---------------- Quest -------------------*/
export type QuestState = 'inactive' | 'active' | 'complete';

export interface QuestRow {
  questId: number;
  category: number;
  type: number;
  state: QuestState;

  title: string;
  detail: string;

  progress?: number;
  bonusFlag?: number;
  materials?: number[];

  updatedAt: number;

}

export type QuestRowWrite = QuestRow;

export interface QuestRepository {
  upsertBatch(rows: ReadonlyArray<QuestRowWrite>): Promise<void>;
  list(): Promise<ReadonlyArray<QuestRow>>;
  get(questId: number): Promise<QuestRow | null>;

  listByState(state: QuestState): Promise<ReadonlyArray<QuestRow>>;
}

/**---------------- Expedition -------------------*/

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
  admiral:AdmiralRepository;
  material:MaterialsRepository;
  slotitem:SlotItemRepository;
  expedition: ExpeditionRepository;
  deck:DeckRepository;
  quest:QuestRepository;
}

