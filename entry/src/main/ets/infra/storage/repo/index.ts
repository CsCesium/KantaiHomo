import type {
  AdmiralRow,
  AdmiralRepository,
  MaterialsRow,
  MaterialsRowWrite,
  MaterialsRepository,
  ShipRow,
  ShipMasterRow,
  ShipJoinedRow,
  ShipRepository,
  SlotItemRow,
  SlotItemMasterRow,
  SlotItemJoinedRow,
  SlotItemRepository,
  DeckRow,
  DeckRepository,
  QuestRow,
  QuestStateDb,
  QuestRepository,
  KdockRow,
  KdockRepository,
  NdockRow,
  NdockRepository,
  ExpeditionRow,
  ExpeditionRepository,
  RepositoryHub,
  BattleRecordRepository,
  BattleRecordRow,
  SortieRecordRepository,
  SortieRecordRow,
} from '../types';
import {
  ShipDao,
  SlotItemDao,
  AdmiralDao,
  MaterialsDao,
  DeckDao,
  QuestDao,
  KdockDao,
  NdockDao,
  ExpeditionDao,
  BattleDao,
  SortieDao,
} from '../dao';

// ==================== Admiral ====================

export class AdmiralRepositoryImpl implements AdmiralRepository {
  async upsert(row: AdmiralRow): Promise<void> {
    await AdmiralDao.upsert(row);
  }

  async get(memberId: number): Promise<AdmiralRow | null> {
    return AdmiralDao.get(memberId);
  }

  async getLatest(): Promise<AdmiralRow | null> {
    return AdmiralDao.getLatest();
  }
}

// ==================== Materials ====================

export class MaterialsRepositoryImpl implements MaterialsRepository {
  async append(row: MaterialsRowWrite): Promise<void> {
    await MaterialsDao.insert(row);
  }

  async appendIfChanged(row: MaterialsRowWrite): Promise<boolean> {
    const latest = await MaterialsDao.getLatest();
    if (latest && this.isSame(latest, row)) {
      return false;
    }
    await MaterialsDao.insert(row);
    return true;
  }

  async getLatest(): Promise<MaterialsRow | null> {
    return MaterialsDao.getLatest();
  }

  async listBetween(startMs: number, endMs: number, limit = 1000): Promise<readonly MaterialsRow[]> {
    return MaterialsDao.listBetween(startMs, endMs, limit);
  }

  async listLatest(limit: number): Promise<readonly MaterialsRow[]> {
    return MaterialsDao.listLatest(limit);
  }

  private isSame(a: MaterialsRow, b: MaterialsRowWrite): boolean {
    return a.fuel === b.fuel
      && a.ammo === b.ammo
      && a.steel === b.steel
      && a.bauxite === b.bauxite
      && a.instantBuild === b.instantBuild
      && a.instantRepair === b.instantRepair
      && a.devMaterial === b.devMaterial
      && a.screw === b.screw;
  }
}

// ==================== Ship ====================

export class ShipRepositoryImpl implements ShipRepository {
  async upsertMasterBatch(rows: readonly ShipMasterRow[]): Promise<void> {
    await ShipDao.upsertMasterBatch(rows);
  }

  async upsertBatch(rows: readonly ShipRow[]): Promise<void> {
    await ShipDao.upsertBatch(rows);
  }

  async getWithMaster(uid: number): Promise<ShipJoinedRow | null> {
    return ShipDao.getWithMaster(uid);
  }

  async listWithMaster(): Promise<readonly ShipJoinedRow[]> {
    return ShipDao.listWithMaster();
  }
}

// ==================== SlotItem ====================

export class SlotItemRepositoryImpl implements SlotItemRepository {
  async upsertMasterBatch(rows: readonly SlotItemMasterRow[]): Promise<void> {
    await SlotItemDao.upsertMasterBatch(rows);
  }

  async upsertBatch(rows: readonly SlotItemRow[]): Promise<void> {
    await SlotItemDao.upsertBatch(rows);
  }

  async getWithMaster(uid: number): Promise<SlotItemJoinedRow | null> {
    return SlotItemDao.getWithMaster(uid);
  }

  async listWithMaster(): Promise<readonly SlotItemJoinedRow[]> {
    return SlotItemDao.listWithMaster();
  }

  async listWithMasterByUids(uids: readonly number[]): Promise<readonly SlotItemJoinedRow[]> {
    return SlotItemDao.listWithMasterByUids(uids);
  }
}

// ==================== Deck ====================

export class DeckRepositoryImpl implements DeckRepository {
  async upsertBatch(rows: readonly DeckRow[]): Promise<void> {
    await DeckDao.upsertBatch(rows);
  }

  async list(): Promise<readonly DeckRow[]> {
    return DeckDao.list();
  }

  async get(deckId: number): Promise<DeckRow | null> {
    return DeckDao.get(deckId);
  }
}

// ==================== Quest ====================

export class QuestRepositoryImpl implements QuestRepository {
  async upsertBatch(rows: readonly QuestRow[]): Promise<void> {
    await QuestDao.upsertBatch(rows);
  }

  async list(): Promise<readonly QuestRow[]> {
    return QuestDao.list();
  }

  async get(questId: number): Promise<QuestRow | null> {
    return QuestDao.get(questId);
  }

  async listByState(state: QuestStateDb): Promise<readonly QuestRow[]> {
    return QuestDao.listByState(state);
  }
}

// ==================== Kdock ====================

export class KdockRepositoryImpl implements KdockRepository {
  async upsertBatch(rows: readonly KdockRow[]): Promise<void> {
    await KdockDao.upsertBatch(rows);
  }

  async list(): Promise<readonly KdockRow[]> {
    return KdockDao.list();
  }

  async get(dockId: number): Promise<KdockRow | null> {
    return KdockDao.get(dockId);
  }
}

// ==================== Ndock ====================

export class NdockRepositoryImpl implements NdockRepository {
  async upsertBatch(rows: readonly NdockRow[]): Promise<void> {
    await NdockDao.upsertBatch(rows);
  }

  async list(): Promise<readonly NdockRow[]> {
    return NdockDao.list();
  }

  async get(dockId: number): Promise<NdockRow | null> {
    return NdockDao.get(dockId);
  }

  async getNextAfter(nowMs: number): Promise<{ dockId: number; shipUid: number; completeTime: number } | null> {
    return NdockDao.getNextAfter(nowMs);
  }
}

// ==================== Expedition ====================

export class ExpeditionRepositoryImpl implements ExpeditionRepository {
  async upsertBatch(rows: readonly ExpeditionRow[]): Promise<void> {
    await ExpeditionDao.upsertBatch(rows);
  }

  async list(): Promise<readonly ExpeditionRow[]> {
    return ExpeditionDao.list();
  }

  async getNextAfter(nowMs: number): Promise<{ deckId: number; missionId: number; returnTime: number } | null> {
    return ExpeditionDao.getNextAfter(nowMs);
  }
}
// ==================== Battle Record ====================

export class BattleRecordRepositoryImpl implements BattleRecordRepository {
  async insert(row: BattleRecordRow): Promise<void> {
    await BattleDao.insert(row);
  }

  async get(id: string): Promise<BattleRecordRow | null> {
    return BattleDao.get(id);
  }

  async listBySortie(sortieId: string): Promise<readonly BattleRecordRow[]> {
    return BattleDao.listBySortie(sortieId);
  }

  async listByMap(mapAreaId: number, mapInfoNo: number, limit = 100): Promise<readonly BattleRecordRow[]> {
    return BattleDao.listByMap(mapAreaId, mapInfoNo, limit);
  }

  async listRecent(limit: number): Promise<readonly BattleRecordRow[]> {
    return BattleDao.listRecent(limit);
  }

  async delete(id: string): Promise<void> {
    await BattleDao.remove(id);
  }

  async deleteOlderThan(timestampMs: number): Promise<number> {
    return BattleDao.deleteOlderThan(timestampMs);
  }
}

// ==================== Sortie Record ====================

export class SortieRecordRepositoryImpl implements SortieRecordRepository {
  async insert(row: SortieRecordRow): Promise<void> {
    await SortieDao.insert(row);
  }

  async update(row: SortieRecordRow): Promise<void> {
    await SortieDao.update(row);
  }

  async get(id: string): Promise<SortieRecordRow | null> {
    return SortieDao.get(id);
  }

  async listByMap(mapAreaId: number, mapInfoNo: number, limit = 100): Promise<readonly SortieRecordRow[]> {
    return SortieDao.listByMap(mapAreaId, mapInfoNo, limit);
  }

  async listRecent(limit: number): Promise<readonly SortieRecordRow[]> {
    return SortieDao.listRecent(limit);
  }

  async delete(id: string): Promise<void> {
    await SortieDao.remove(id);
  }
}


// ==================== Repository Hub ====================

class RepositoryHubImpl implements RepositoryHub {
  private _admiral: AdmiralRepository | null = null;
  private _material: MaterialsRepository | null = null;
  private _ship: ShipRepository | null = null;
  private _slotitem: SlotItemRepository | null = null;
  private _deck: DeckRepository | null = null;
  private _quest: QuestRepository | null = null;
  private _build: KdockRepository | null = null;
  private _repair: NdockRepository | null = null;
  private _expedition: ExpeditionRepository | null = null;
  private _battle: BattleRecordRepository | null = null;
  private _sortie: SortieRecordRepository | null = null;

  get admiral(): AdmiralRepository {
    return this._admiral ??= new AdmiralRepositoryImpl();
  }

  get material(): MaterialsRepository {
    return this._material ??= new MaterialsRepositoryImpl();
  }

  get ship(): ShipRepository {
    return this._ship ??= new ShipRepositoryImpl();
  }

  get slotitem(): SlotItemRepository {
    return this._slotitem ??= new SlotItemRepositoryImpl();
  }

  get deck(): DeckRepository {
    return this._deck ??= new DeckRepositoryImpl();
  }

  get quest(): QuestRepository {
    return this._quest ??= new QuestRepositoryImpl();
  }

  get build(): KdockRepository {
    return this._build ??= new KdockRepositoryImpl();
  }

  get repair(): NdockRepository {
    return this._repair ??= new NdockRepositoryImpl();
  }

  get expedition(): ExpeditionRepository {
    return this._expedition ??= new ExpeditionRepositoryImpl();
  }

  get battle(): BattleRecordRepository {
    return this._battle ??= new BattleRecordRepositoryImpl();
  }

  get sortie(): SortieRecordRepository {
    return this._sortie ??= new SortieRecordRepositoryImpl();
  }

  reset(): void {
    this._admiral = null;
    this._material = null;
    this._ship = null;
    this._slotitem = null;
    this._deck = null;
    this._quest = null;
    this._build = null;
    this._repair = null;
    this._expedition = null;
    this._battle = null;
    this._sortie = null;
  }
}

// Singleton
let _hub: RepositoryHubImpl | null = null;

export function getRepositoryHub(): RepositoryHub {
  return _hub ??= new RepositoryHubImpl();
}

export function resetRepositoryHub(): void {
  _hub?.reset();
}

// Convenience export
export const repos = {
  get admiral() { return getRepositoryHub().admiral; },
  get material() { return getRepositoryHub().material; },
  get ship() { return getRepositoryHub().ship; },
  get slotitem() { return getRepositoryHub().slotitem; },
  get deck() { return getRepositoryHub().deck; },
  get quest() { return getRepositoryHub().quest; },
  get build() { return getRepositoryHub().build; },
  get repair() { return getRepositoryHub().repair; },
  get expedition() { return getRepositoryHub().expedition; },
  get battle() { return getRepositoryHub().battle; },
  get sortie() { return getRepositoryHub().sortie; },
};

