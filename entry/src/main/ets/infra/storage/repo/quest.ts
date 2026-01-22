import type { QuestRepository, QuestRowWrite, QuestRow, QuestState } from './types';

type DaoModule = typeof import('../dao/quest');
type DbRow = import('../dao/quest').QuestDbRow;

let _dao: DaoModule | null = null;
async function loadDao(): Promise<DaoModule> {
  if (_dao) return _dao;
  _dao = await import('../dao/quest');
  return _dao;
}

function stateToInt(s: QuestState): number {
  switch (s) {
    case 'inactive': return 0;
    case 'active': return 1;
    case 'complete': return 2;
    default: return 0;
  }
}

function intToState(v: number): QuestState {
  switch (v) {
    case 1: return 'active';
    case 2: return 'complete';
    case 0:
    default: return 'inactive';
  }
}

function safeParseNumArray(json: string | null): number[] | undefined {
  if (!json) return undefined;
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return undefined;
    const out: number[] = [];
    for (let i = 0; i < v.length; i++) {
      const n = v[i];
      if (typeof n === 'number' && Number.isFinite(n)) out.push(n);
    }
    return out;
  } catch {
    return undefined;
  }
}

export class QuestRepositoryDb implements QuestRepository {
  async upsertBatch(rows: ReadonlyArray<QuestRowWrite>): Promise<void> {
    const Dao = await loadDao();
    const now = Date.now();

    const mapped: DbRow[] = rows.map((r) => ({
      questId: r.questId,
      category: r.category ?? 0,
      type: r.type ?? 0,
      state: stateToInt(r.state ?? 'inactive'),
      title: r.title ?? '',
      detail: r.detail ?? '',

      progress: (typeof r.progress === 'number') ? r.progress : null,
      bonusFlag: (typeof r.bonusFlag === 'number') ? r.bonusFlag : null,
      materialsJson: (Array.isArray(r.materials)) ? JSON.stringify(r.materials) : null,

      updatedAt: (typeof r.updatedAt === 'number' && r.updatedAt > 0) ? r.updatedAt : now,
    }));

    await Dao.upsertBatch(mapped);
  }

  async list(): Promise<ReadonlyArray<QuestRow>> {
    const Dao = await loadDao();
    const rows = await Dao.listQuests();
    return rows.map((r) => ({
      questId: r.questId,
      category: r.category,
      type: r.type,
      state: intToState(r.state),
      title: r.title,
      detail: r.detail,
      progress: r.progress ?? undefined,
      bonusFlag: r.bonusFlag ?? undefined,
      materials: safeParseNumArray(r.materialsJson),
      updatedAt: r.updatedAt,
    }));
  }

  async get(questId: number): Promise<QuestRow | null> {
    const Dao = await loadDao();
    const r = await Dao.getQuest(questId);
    if (!r) return null;
    return {
      questId: r.questId,
      category: r.category,
      type: r.type,
      state: intToState(r.state),
      title: r.title,
      detail: r.detail,
      progress: r.progress ?? undefined,
      bonusFlag: r.bonusFlag ?? undefined,
      materials: safeParseNumArray(r.materialsJson),
      updatedAt: r.updatedAt,
    };
  }

  async listByState(state: QuestState): Promise<ReadonlyArray<QuestRow>> {
    const Dao = await loadDao();
    const rows = await Dao.listQuestsByState(stateToInt(state));
    return rows.map((r) => ({
      questId: r.questId,
      category: r.category,
      type: r.type,
      state: intToState(r.state),
      title: r.title,
      detail: r.detail,
      progress: r.progress ?? undefined,
      bonusFlag: r.bonusFlag ?? undefined,
      materials: safeParseNumArray(r.materialsJson),
      updatedAt: r.updatedAt,
    }));
  }
}