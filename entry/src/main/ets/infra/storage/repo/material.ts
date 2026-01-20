import { MaterialsRepository, MaterialsRowWrite, MaterialsRow } from './types';

type DaoModule = typeof import('../dao/materials');
type DbRow = import('../dao/materials').MaterialsRow;

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

export class MaterialsRepositoryDb implements MaterialsRepository {
  async upsert(row: MaterialsRowWrite, memberId: number = 0): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();

    const mapped: DbRow = {
      memberId,
      fuel: nz(row.fuel),
      ammo: nz(row.ammo),
      steel: nz(row.steel),
      bauxite: nz(row.bauxite),
      instantBuild: nz(row.instantBuild),
      instantRepair: nz(row.instantRepair),
      devMaterial: nz(row.devMaterial),
      screw: nz(row.screw),
      updatedAt: typeof row.updatedAt === 'number' && row.updatedAt > 0 ? row.updatedAt : now,
    };

    await Dao.upsert(mapped);
  }

  async get(memberId: number = 0): Promise<MaterialsRow | null> {
    const Dao = await loadDao();
    return await Dao.getMaterials(memberId);
  }

  async getLatest(): Promise<MaterialsRow | null> {
    const Dao = await loadDao();
    return await Dao.getLatestMaterials();
  }
}