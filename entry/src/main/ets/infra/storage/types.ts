/**
 * Storage Row Types - 数据库行类型定义
 *
 * 设计原则：
 * 1. Row 类型字段与数据库列名完全对应
 * 2. Repository 接口定义在此文件
 */

import type relationalStore from '@ohos.data.relationalStore';

// ==================== Transaction ====================

export interface Tx {
  store: relationalStore.RdbStore;
}

export interface UnitOfWork {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

// ==================== Admiral ====================

export interface AdmiralRow {
  memberId: number;
  nickname: string;
  level: number;
  experience: number;
  maxShips: number;
  maxSlotItems: number;
  rank: number | null;
  largeDockEnabled: number | null;  // 0 | 1
  updatedAt: number;
}

export interface AdmiralRepository {
  upsert(row: AdmiralRow): Promise<void>;
  get(memberId: number): Promise<AdmiralRow | null>;
  getLatest(): Promise<AdmiralRow | null>;
}

// ==================== Materials ====================

export interface MaterialsRow {
  id: number;  // AUTO INCREMENT
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
  appendIfChanged(row: MaterialsRowWrite): Promise<boolean>;
  getLatest(): Promise<MaterialsRow | null>;
  listBetween(startMs: number, endMs: number, limit?: number): Promise<readonly MaterialsRow[]>;
  listLatest(limit: number): Promise<readonly MaterialsRow[]>;
}

// ==================== Ship Master ====================

export interface ShipMasterRow {
  id: number;
  sortNo: number;
  name: string;
  stype: number | null;
  ctype: number | null;
  speed: number | null;
  range: number | null;
  slotNum: number | null;
  maxEqJson: string | null;  // JSON number[]
  afterLv: number | null;
  afterShipId: number | null;
  updatedAt: number;
}

// ==================== Ship ====================

export interface ShipRow {
  uid: number;
  sortNo: number;
  masterId: number;

  level: number;
  expTotal: number;
  expToNext: number;
  expGauge: number;

  nowHp: number;
  maxHp: number;
  speed: number;
  range: number;

  slotsJson: string;   // JSON number[]
  onslotJson: string;  // JSON number[]
  slotEx: number;

  modern_fp: number;
  modern_tp: number;
  modern_aa: number;
  modern_ar: number;
  modern_luck: number;
  modern_hp: number;
  modern_asw: number;

  backs: number;
  fuel: number;
  bull: number;
  slotnum: number;

  ndockTime: number;
  ndockFuel: number;
  ndockSteel: number;

  srate: number;
  cond: number;

  fp_cur: number;
  fp_max: number;
  tp_cur: number;
  tp_max: number;
  aa_cur: number;
  aa_max: number;
  ar_cur: number;
  ar_max: number;
  ev_cur: number;
  ev_max: number;
  asw_cur: number;
  asw_max: number;
  sc_cur: number;
  sc_max: number;
  luck_cur: number;
  luck_max: number;

  locked: number;       // 0 | 1
  lockedEquip: number;  // 0 | 1
  sallyArea: number | null;

  updatedAt: number;
}

/** Ship + Master JOIN 查询结果 */
export interface ShipJoinedRow extends ShipRow {
  mst_id: number | null;
  mst_sortNo: number | null;
  mst_name: string | null;
  mst_stype: number | null;
  mst_ctype: number | null;
  mst_speed: number | null;
  mst_range: number | null;
  mst_slotNum: number | null;
  mst_maxEqJson: string | null;
  mst_afterLv: number | null;
  mst_afterShipId: number | null;
  mst_updatedAt: number | null;
}

export interface ShipRepository {
  upsertMasterBatch(rows: readonly ShipMasterRow[]): Promise<void>;
  upsertBatch(rows: readonly ShipRow[]): Promise<void>;
  getWithMaster(uid: number): Promise<ShipJoinedRow | null>;
  listWithMaster(): Promise<readonly ShipJoinedRow[]>;
}

// ==================== SlotItem Master ====================

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

  cost: number | null;
  distance: number | null;
  useBull: number | null;
  gfxVersion: number | null;

  updatedAt: number;
}

// ==================== SlotItem ====================

export interface SlotItemRow {
  uid: number;
  masterId: number;
  locked: number;  // 0 | 1
  level: number | null;
  alv: number | null;
  updatedAt: number;
}

/** SlotItem + Master JOIN 查询结果 */
export interface SlotItemJoinedRow extends SlotItemRow {
  mst_id: number | null;
  mst_sortNo: number | null;
  mst_name: string | null;

  mst_typeMajor: number | null;
  mst_typeBook: number | null;
  mst_typeEquipType: number | null;
  mst_typeIconId: number | null;
  mst_typeAircraft: number | null;

  mst_rarity: number | null;
  mst_range: number | null;

  mst_stat_hp: number | null;
  mst_stat_armor: number | null;
  mst_stat_firepower: number | null;
  mst_stat_torpedo: number | null;
  mst_stat_speed: number | null;
  mst_stat_bomb: number | null;
  mst_stat_aa: number | null;
  mst_stat_asw: number | null;
  mst_stat_hit: number | null;
  mst_stat_evasion: number | null;
  mst_stat_los: number | null;
  mst_stat_luck: number | null;

  mst_broken_fuel: number | null;
  mst_broken_ammo: number | null;
  mst_broken_steel: number | null;
  mst_broken_bauxite: number | null;

  mst_cost: number | null;
  mst_distance: number | null;
  mst_useBull: number | null;
  mst_gfxVersion: number | null;

  mst_updatedAt: number | null;
}

export interface SlotItemRepository {
  upsertMasterBatch(rows: readonly SlotItemMasterRow[]): Promise<void>;
  upsertBatch(rows: readonly SlotItemRow[]): Promise<void>;
  getWithMaster(uid: number): Promise<SlotItemJoinedRow | null>;
  listWithMaster(): Promise<readonly SlotItemJoinedRow[]>;
  listWithMasterByUids(uids: readonly number[]): Promise<readonly SlotItemJoinedRow[]>;
}

// ==================== Deck ====================

export interface DeckRow {
  deckId: number;
  name: string;
  shipUidsJson: string;  // JSON number[]

  expeditionProgress: number;
  expeditionMissionId: number;
  expeditionReturnTime: number;
  expeditionUpdatedAt: number;

  updatedAt: number;
}

export interface DeckRepository {
  upsertBatch(rows: readonly DeckRow[]): Promise<void>;
  list(): Promise<readonly DeckRow[]>;
  get(deckId: number): Promise<DeckRow | null>;
}

// ==================== Quest ====================

export type QuestStateDb = 0 | 1 | 2;  // 0=inactive, 1=active, 2=complete

export interface QuestRow {
  questId: number;
  category: number;
  type: number;
  state: QuestStateDb;
  title: string;
  detail: string;
  progress: number | null;
  bonusFlag: number | null;
  materialsJson: string | null;  // JSON number[]
  updatedAt: number;
}

export interface QuestRepository {
  upsertBatch(rows: readonly QuestRow[]): Promise<void>;
  list(): Promise<readonly QuestRow[]>;
  get(questId: number): Promise<QuestRow | null>;
  listByState(state: QuestStateDb): Promise<readonly QuestRow[]>;
}

// ==================== Kdock ====================

export type KdockStateDb = 0 | 1 | 2 | 3;

export interface KdockRow {
  dockId: number;
  state: KdockStateDb;
  createdShipMasterId: number;
  completeTime: number;
  completeTimeStr: string;
  costFuel: number;
  costAmmo: number;
  costSteel: number;
  costBauxite: number;
  costDev: number;
  updatedAt: number;
}

export interface KdockRepository {
  upsertBatch(rows: readonly KdockRow[]): Promise<void>;
  list(): Promise<readonly KdockRow[]>;
  get(dockId: number): Promise<KdockRow | null>;
}

// ==================== Ndock ====================

export interface NdockRow {
  dockId: number;
  state: number;
  shipUid: number;
  completeTime: number;
  completeTimeStr: string | null;
  costFuel: number;
  costSteel: number;
  updatedAt: number;
}

export interface NdockRepository {
  upsertBatch(rows: readonly NdockRow[]): Promise<void>;
  list(): Promise<readonly NdockRow[]>;
  get(dockId: number): Promise<NdockRow | null>;
  getNextAfter(nowMs: number): Promise<{ dockId: number; shipUid: number; completeTime: number } | null>;
}

// ==================== Expedition ====================

export interface ExpeditionRow {
  deckId: number;
  missionId: number;
  progress: number;
  returnTime: number;
  updatedAt: number;
}

export interface ExpeditionRepository {
  upsertBatch(rows: readonly ExpeditionRow[]): Promise<void>;
  list(): Promise<readonly ExpeditionRow[]>;
  getNextAfter(nowMs: number): Promise<{ deckId: number; missionId: number; returnTime: number } | null>;
}

// ==================== Battle Record ====================

export interface BattleRecordRow {
  id: string;
  sortieId: string;

  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  cellEventId: number;
  isBoss: number;  // 0 | 1

  battleType: string;  // 'normal' | 'combined_ctf' | 'combined_stf' | 'combined_tcf' | 'practice' | 'air_raid'
  isPractice: number;  // 0 | 1

  friendFormation: number | null;
  enemyFormation: number | null;
  engagement: number | null;
  airState: number | null;

  // JSON fields
  friendFleetJson: string;
  friendFleetEscortJson: string | null;
  enemyFleetJson: string;
  enemyFleetEscortJson: string | null;
  airBasesJson: string | null;
  hpStartJson: string;
  hpEndJson: string;

  rank: string;
  mvp: number | null;
  mvpCombined: number | null;
  dropShipId: number | null;
  dropShipName: string | null;
  dropItemId: number | null;
  baseExp: number | null;

  startedAt: number;
  endedAt: number;
  createdAt: number;
}

export interface BattleRecordRepository {
  insert(row: BattleRecordRow): Promise<void>;
  get(id: string): Promise<BattleRecordRow | null>;
  listBySortie(sortieId: string): Promise<readonly BattleRecordRow[]>;
  listByMap(mapAreaId: number, mapInfoNo: number, limit?: number): Promise<readonly BattleRecordRow[]>;
  listRecent(limit: number): Promise<readonly BattleRecordRow[]>;
  delete(id: string): Promise<void>;
  deleteOlderThan(timestampMs: number): Promise<number>;
}

// ==================== Sortie Record ====================

export interface SortieRecordRow {
  id: string;

  mapAreaId: number;
  mapInfoNo: number;
  deckId: number;
  combinedType: number;

  fleetSnapshotJson: string;
  fleetSnapshotEscortJson: string | null;

  routeJson: string;  // JSON number[]

  result: string;  // 'ongoing' | 'cleared' | 'retreated' | 'sunk'
  bossReached: number;  // 0 | 1
  bossKilled: number;   // 0 | 1

  fuelUsed: number;
  ammoUsed: number;

  startedAt: number;
  endedAt: number | null;
  createdAt: number;
}

export interface SortieRecordRepository {
  insert(row: SortieRecordRow): Promise<void>;
  update(row: SortieRecordRow): Promise<void>;
  get(id: string): Promise<SortieRecordRow | null>;
  listByMap(mapAreaId: number, mapInfoNo: number, limit?: number): Promise<readonly SortieRecordRow[]>;
  listRecent(limit: number): Promise<readonly SortieRecordRow[]>;
  delete(id: string): Promise<void>;
}

// ==================== Repository Hub ====================

export interface RepositoryHub {
  admiral: AdmiralRepository;
  material: MaterialsRepository;
  slotitem: SlotItemRepository;
  expedition: ExpeditionRepository;
  deck: DeckRepository;
  quest: QuestRepository;
  build: KdockRepository;
  repair: NdockRepository;
  ship: ShipRepository;
  battle: BattleRecordRepository;
  sortie: SortieRecordRepository;
}
