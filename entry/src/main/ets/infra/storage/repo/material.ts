import { MaterialsRepository, MaterialsRowWrite, MaterialsRow } from './types';

type DaoModule = typeof import('../dao/materials');
type DbRowWrite = import('./types').MaterialsRowWrite;
type DbRow = import('./types').MaterialsRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/materials');
  return _dao;
}

function nz(v: number | undefined | null): number {
  const n = typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function same(a: MaterialsRowWrite, b: MaterialsRow): boolean {
  return a.fuel === b.fuel &&
    a.ammo === b.ammo &&
    a.steel === b.steel &&
    a.bauxite === b.bauxite &&
    a.instantBuild === b.instantBuild &&
    a.instantRepair === b.instantRepair &&
    a.devMaterial === b.devMaterial &&
    a.screw === b.screw;
}

export class MaterialsRepositoryDb implements MaterialsRepository {
  async append(row: MaterialsRowWrite): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();

    const mapped: DbRowWrite = {
      fuel: nz(row.fuel),
      ammo: nz(row.ammo),
      steel: nz(row.steel),
      bauxite: nz(row.bauxite),
      instantBuild: nz(row.instantBuild),
      instantRepair: nz(row.instantRepair),
      devMaterial: nz(row.devMaterial),
      screw: nz(row.screw),
      updatedAt: (typeof row.updatedAt === 'number' && row.updatedAt > 0) ? row.updatedAt : now,
    };

    await Dao.insert(mapped);
  }

  async appendIfChanged(row: MaterialsRowWrite): Promise<boolean> {
    const Dao = await loadDao();
    const latest = await Dao.getLatest();
    if (latest && same({
      ...row,
      fuel: nz(row.fuel),
      ammo: nz(row.ammo),
      steel: nz(row.steel),
      bauxite: nz(row.bauxite),
      instantBuild: nz(row.instantBuild),
      instantRepair: nz(row.instantRepair),
      devMaterial: nz(row.devMaterial),
      screw: nz(row.screw),
      updatedAt: row.updatedAt,
    }, latest)) {
      return false;
    }
    await this.append(row);
    return true;
  }

  async getLatest(): Promise<MaterialsRow | null> {
    const Dao = await loadDao();
    return await Dao.getLatest();
  }

  async listBetween(startMs: number, endMs: number, limit: number = 2000): Promise<ReadonlyArray<MaterialsRow>> {
    const Dao = await loadDao();
    return await Dao.listBetween(startMs, endMs, limit);
  }

  async listLatest(limit: number): Promise<ReadonlyArray<MaterialsRow>> {
    const Dao = await loadDao();
    return await Dao.listLatest(limit);
  }
}