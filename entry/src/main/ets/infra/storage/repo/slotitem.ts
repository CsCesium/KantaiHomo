import { SlotItemMasterRow,
  SlotItemMasterRowWrite,
  SlotItemRepository,
  SlotItemRow,
  SlotItemRowWrite,
  SlotItemWithMaster } from './types';

type DaoModule = typeof import('../dao/slotitem');
type MasterDbRow = import('./types').SlotItemMasterRow;
type InstDbRow = import('./types').SlotItemRow;
type JoinedDbRow = import('../dao/slotitem').SlotItemJoinedRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/slotitem');
  return _dao;
}

function nz(v?: number | null): number { return (typeof v === 'number' && Number.isFinite(v)) ? v : 0; }
function nnull(v?: number): number | null { return (typeof v === 'number' && Number.isFinite(v)) ? v : null; }

function mapJoinedToRepo(row: JoinedDbRow, masterCache: Map<number, SlotItemMasterRow>): SlotItemWithMaster {
  const item: SlotItemRow = {
    uid: row.uid,
    masterId: row.masterId,
    locked: row.locked === 1,
    level: row.level ?? undefined,
    alv: row.alv ?? undefined,
    updatedAt: row.itemUpdatedAt,
  };

  if (row.mst_id == null) {
    return { item, master: null };
  }

  const mid = row.mst_id;
  const cached = masterCache.get(mid);
  if (cached) return { item, master: cached };

  const master: SlotItemMasterRow = {
    id: mid,
    sortNo: row.mst_sortNo ?? 0,
    name: row.mst_name ?? '',

    typeMajor: row.mst_typeMajor ?? 0,
    typeBook: row.mst_typeBook ?? 0,
    typeEquipType: row.mst_typeEquipType ?? 0,
    typeIconId: row.mst_typeIconId ?? 0,
    typeAircraft: row.mst_typeAircraft ?? 0,

    rarity: row.mst_rarity ?? 0,
    range: row.mst_range ?? 0,

    stat_hp: row.mst_stat_hp ?? 0,
    stat_armor: row.mst_stat_armor ?? 0,
    stat_firepower: row.mst_stat_firepower ?? 0,
    stat_torpedo: row.mst_stat_torpedo ?? 0,
    stat_speed: row.mst_stat_speed ?? 0,
    stat_bomb: row.mst_stat_bomb ?? 0,
    stat_aa: row.mst_stat_aa ?? 0,
    stat_asw: row.mst_stat_asw ?? 0,
    stat_hit: row.mst_stat_hit ?? 0,
    stat_evasion: row.mst_stat_evasion ?? 0,
    stat_los: row.mst_stat_los ?? 0,
    stat_luck: row.mst_stat_luck ?? 0,

    broken_fuel: row.mst_broken_fuel ?? 0,
    broken_ammo: row.mst_broken_ammo ?? 0,
    broken_steel: row.mst_broken_steel ?? 0,
    broken_bauxite: row.mst_broken_bauxite ?? 0,

    cost: row.mst_cost ?? undefined,
    distance: row.mst_distance ?? undefined,
    useBull: row.mst_useBull ?? undefined,
    gfxVersion: row.mst_gfxVersion ?? undefined,

    updatedAt: row.mst_updatedAt ?? 0,
  };

  masterCache.set(mid, master);
  return { item, master };
}


export class SlotItemRepositoryDb implements SlotItemRepository {
  async upsertMasterBatch(rows: ReadonlyArray<SlotItemMasterRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();
    const mapped: MasterDbRow[] = [];

    for (const r of rows) {
      mapped.push({
        id: r.id,
        sortNo: nz(r.sortNo),
        name: r.name ?? '',

        typeMajor: nz(r.typeMajor),
        typeBook: nz(r.typeBook),
        typeEquipType: nz(r.typeEquipType),
        typeIconId: nz(r.typeIconId),
        typeAircraft: nz(r.typeAircraft),

        rarity: nz(r.rarity),
        range: nz(r.range),

        stat_hp: nz(r.stat_hp),
        stat_armor: nz(r.stat_armor),
        stat_firepower: nz(r.stat_firepower),
        stat_torpedo: nz(r.stat_torpedo),
        stat_speed: nz(r.stat_speed),
        stat_bomb: nz(r.stat_bomb),
        stat_aa: nz(r.stat_aa),
        stat_asw: nz(r.stat_asw),
        stat_hit: nz(r.stat_hit),
        stat_evasion: nz(r.stat_evasion),
        stat_los: nz(r.stat_los),
        stat_luck: nz(r.stat_luck),

        broken_fuel: nz(r.broken_fuel),
        broken_ammo: nz(r.broken_ammo),
        broken_steel: nz(r.broken_steel),
        broken_bauxite: nz(r.broken_bauxite),

        cost: nnull(r.cost),
        distance: nnull(r.distance),
        useBull: nnull(r.useBull),
        gfxVersion: nnull(r.gfxVersion),

        updatedAt: (typeof r.updatedAt === 'number' && r.updatedAt > 0) ? r.updatedAt : now,
      });
    }

    await Dao.upsertMasterBatch(mapped);
  }

  async upsertBatch(rows: ReadonlyArray<SlotItemRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();
    const mapped: InstDbRow[] = [];

    for (const r of rows) {
      mapped.push({
        uid: r.uid,
        masterId: r.masterId,
        locked: r.locked,
        level: (typeof r.level === 'number') ? r.level : null,
        alv: (typeof r.alv === 'number') ? r.alv : null,
        updatedAt: (typeof r.updatedAt === 'number' && r.updatedAt > 0) ? r.updatedAt : now,
      });
    }

    await Dao.upsertBatch(mapped);
  }

  async getWithMaster(uid: number): Promise<SlotItemWithMaster | null> {
    const Dao = await loadDao();
    const r = await Dao.getWithMaster(uid);
    if (!r) return null;
    const cache = new Map<number, SlotItemMasterRow>();
    return mapJoinedToRepo(r, cache);
  }

  async listWithMaster(): Promise<ReadonlyArray<SlotItemWithMaster>> {
    const Dao = await loadDao();
    const rows = await Dao.listWithMaster();
    const cache = new Map<number, SlotItemMasterRow>();
    return rows.map((r) => mapJoinedToRepo(r, cache));
  }

  async listWithMasterByUids(uids: ReadonlyArray<number>): Promise<ReadonlyArray<SlotItemWithMaster>> {
    const Dao = await loadDao();
    const rows = await Dao.listWithMasterByUids(uids);
    const cache = new Map<number, SlotItemMasterRow>();
    return rows.map((r) => mapJoinedToRepo(r, cache));
  }
}