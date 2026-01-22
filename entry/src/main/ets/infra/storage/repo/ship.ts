import { ShipMasterRow, ShipWithMaster, ShipRow, ShipRepository, ShipMasterRowWrite, ShipRowWrite } from './types';

type DaoModule = typeof import('../dao/ship');
type MasterDbWrite = import('../dao/ship').ShipMasterDbWrite;
type ShipDbWrite = import('../dao/ship').ShipDbWrite;
type JoinedDbRow = import('../dao/ship').ShipJoinedDbRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/ship');
  return _dao;
}

function b01(v: boolean): 0 | 1 {return v ? 1 : 0;}
function n(v: any, d = 0): number { return (typeof v === 'number' && Number.isFinite(v)) ? v : d; }
function nnull(v: any): number | null { return (typeof v === 'number' && Number.isFinite(v)) ? v : null; }


function mapJoined(row: JoinedDbRow, masterCache: Map<number, ShipMasterRow>): ShipWithMaster {
  const ship: ShipRow = {
    uid: row.uid,
    sortNo: row.sortNo,
    masterId: row.masterId,

    level: row.level,
    expTotal: row.expTotal,
    expToNext: row.expToNext,
    expGauge: row.expGauge,

    nowHp: row.nowHp,
    maxHp: row.maxHp,
    speed: row.speed,
    range: row.range,

    slotsJson: row.slotsJson,
    onslotJson: row.onslotJson,
    slotEx: row.slotEx,

    modern_fp: row.modern_fp,
    modern_tp: row.modern_tp,
    modern_aa: row.modern_aa,
    modern_ar: row.modern_ar,
    modern_luck: row.modern_luck,
    modern_hp: row.modern_hp,
    modern_asw: row.modern_asw,

    backs: row.backs,
    fuel: row.fuel,
    bull: row.bull,
    slotnum: row.slotnum,

    ndockTime: row.ndockTime,
    ndockFuel: row.ndockFuel,
    ndockSteel: row.ndockSteel,

    srate: row.srate,
    cond: row.cond,

    fp_cur: row.fp_cur, fp_max: row.fp_max,
    tp_cur: row.tp_cur, tp_max: row.tp_max,
    aa_cur: row.aa_cur, aa_max: row.aa_max,
    ar_cur: row.ar_cur, ar_max: row.ar_max,
    ev_cur: row.ev_cur, ev_max: row.ev_max,
    asw_cur: row.asw_cur, asw_max: row.asw_max,
    sc_cur: row.sc_cur, sc_max: row.sc_max,
    luck_cur: row.luck_cur, luck_max: row.luck_max,

    locked: row.locked === 1,
    lockedEquip: row.lockedEquip === 1,
    sallyArea: row.sallyArea ?? undefined,

    updatedAt: row.shipUpdatedAt,
  };

  if (row.mst_id == null) return { ship, master: null };

  const mid = row.mst_id;
  const cached = masterCache.get(mid);
  if (cached) return { ship, master: cached };

  const master: ShipMasterRow = {
    id: mid,
    sortNo: row.mst_sortNo ?? 0,
    name: row.mst_name ?? '',

    stype: row.mst_stype ?? undefined,
    ctype: row.mst_ctype ?? undefined,
    speed: row.mst_speed ?? undefined,
    range: row.mst_range ?? undefined,
    slotNum: row.mst_slotNum ?? undefined,

    maxEqJson: row.mst_maxEqJson ?? undefined,
    afterLv: row.mst_afterLv ?? undefined,
    afterShipId: row.mst_afterShipId ?? undefined,

    updatedAt: row.mst_updatedAt ?? 0,
  };

  masterCache.set(mid, master);
  return { ship, master };
}

export class ShipRepositoryDb implements ShipRepository {
  async upsertMasterBatch(rows: ReadonlyArray<ShipMasterRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();
    const mapped: MasterDbWrite[] = rows.map((r) => ({
      id: r.id,
      sortNo: n(r.sortNo),
      name: r.name ?? '',

      stype: nnull(r.stype),
      ctype: nnull(r.ctype),
      speed: nnull(r.speed),
      range: nnull(r.range),
      slotNum: nnull(r.slotNum),

      maxEqJson: (typeof r.maxEqJson === 'string') ? r.maxEqJson : null,
      afterLv: nnull(r.afterLv),
      afterShipId: nnull(r.afterShipId),

      updatedAt: (typeof r.updatedAt === 'number' && r.updatedAt > 0) ? r.updatedAt : now,
    }));
    await Dao.upsertMasterBatch(mapped);
  }

  async upsertBatch(rows: ReadonlyArray<ShipRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();
    const mapped: ShipDbWrite[] = rows.map((r) => ({
      uid: r.uid,
      sortNo: n(r.sortNo),
      masterId: n(r.masterId),

      level: n(r.level),
      expTotal: n(r.expTotal),
      expToNext: n(r.expToNext),
      expGauge: n(r.expGauge),

      nowHp: n(r.nowHp),
      maxHp: n(r.maxHp),
      speed: n(r.speed),
      range: n(r.range),

      slotsJson: (typeof r.slotsJson === 'string' ? r.slotsJson : '[]'),
      onslotJson: (typeof r.onslotJson === 'string' ? r.onslotJson : '[]'),
      slotEx: n(r.slotEx),

      modern_fp: n(r.modern_fp),
      modern_tp: n(r.modern_tp),
      modern_aa: n(r.modern_aa),
      modern_ar: n(r.modern_ar),
      modern_luck: n(r.modern_luck),
      modern_hp: n(r.modern_hp),
      modern_asw: n(r.modern_asw),

      backs: n(r.backs),
      fuel: n(r.fuel),
      bull: n(r.bull),
      slotnum: n(r.slotnum),

      ndockTime: n(r.ndockTime),
      ndockFuel: n(r.ndockFuel),
      ndockSteel: n(r.ndockSteel),

      srate: n(r.srate),
      cond: n(r.cond),

      fp_cur: n(r.fp_cur), fp_max: n(r.fp_max),
      tp_cur: n(r.tp_cur), tp_max: n(r.tp_max),
      aa_cur: n(r.aa_cur), aa_max: n(r.aa_max),
      ar_cur: n(r.ar_cur), ar_max: n(r.ar_max),
      ev_cur: n(r.ev_cur), ev_max: n(r.ev_max),
      asw_cur: n(r.asw_cur), asw_max: n(r.asw_max),
      sc_cur: n(r.sc_cur), sc_max: n(r.sc_max),
      luck_cur: n(r.luck_cur), luck_max: n(r.luck_max),

      locked: b01(!!r.locked),
      lockedEquip: b01(!!r.lockedEquip),
      sallyArea: (typeof r.sallyArea === 'number') ? r.sallyArea : null,

      updatedAt: (typeof r.updatedAt === 'number' && r.updatedAt > 0) ? r.updatedAt : now,
    }));

    await Dao.upsertBatch(mapped);
  }

  async getWithMaster(uid: number): Promise<ShipWithMaster | null> {
    const Dao = await loadDao();
    const row = await Dao.getWithMaster(uid);
    if (!row) return null;
    const cache = new Map<number, ShipMasterRow>();
    return mapJoined(row, cache);
  }

  async listWithMaster(): Promise<ReadonlyArray<ShipWithMaster>> {
    const Dao = await loadDao();
    const rows = await Dao.listWithMaster();
    const cache = new Map<number, ShipMasterRow>();
    return rows.map((r) => mapJoined(r, cache));
  }
}