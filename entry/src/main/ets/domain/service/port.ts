import { getRepositoryHub } from "../../infra/storage/repo";
import { PortSnapshot, Admiral, Materials, materialsToRow, Deck, decksToRows, Ship, Ndock,
  shipsToRows,
  safeParseJson} from "../models";

export async function savePortSnapshot(snapshot: PortSnapshot): Promise<void> {
  const hub = getRepositoryHub();

  // 并行保存各类数据
  const tasks: Promise<void>[] = [];

  // 保存提督信息
  if (snapshot.admiral) {
    tasks.push(saveAdmiral(snapshot.admiral));
  }

  // 保存资源
  if (snapshot.materials) {
    tasks.push(saveMaterials(snapshot.materials));
  }

  // 保存舰队
  if (snapshot.decks && snapshot.decks.length > 0) {
    tasks.push(saveDecks(snapshot.decks));
  }

  // 保存舰船
  if (snapshot.ships && snapshot.ships.length > 0) {
    tasks.push(saveShips(snapshot.ships));
  }

  // 保存入渠
  if (snapshot.ndocks && snapshot.ndocks.length > 0) {
    tasks.push(saveNdocks(snapshot.ndocks));
  }

  await Promise.all(tasks);
}

/**
 * 保存提督信息
 */
export async function saveAdmiral(admiral: Admiral): Promise<void> {
  const hub = getRepositoryHub();
  await hub.admiral.upsert({
    memberId: admiral.memberId,
    nickname: admiral.nickname,
    level: admiral.level,
    experience: admiral.experience,
    maxShips: admiral.maxShips,
    maxSlotItems: admiral.maxSlotItems,
    rank: admiral.rank,
    largeDockEnabled: admiral.largeDockEnabled? 1:0,
    updatedAt: admiral.updatedAt,
  });
}

/**
 * 保存资源（追加记录）
 */
export async function saveMaterials(materials: Materials): Promise<void> {
  const hub = getRepositoryHub();
  await hub.material.appendIfChanged(materialsToRow(materials));
}

/**
 * 保存舰队信息
 */
export async function saveDecks(decks: Deck[]): Promise<void> {
  const hub = getRepositoryHub();
  const rows = decksToRows(decks);
  await hub.deck.upsertBatch(rows);
}

/**
 * 保存舰船信息
 */
export async function saveShips(ships: Ship[]): Promise<void> {
  const hub = getRepositoryHub();
  const rows = shipsToRows(ships);
  await hub.ship.upsertBatch(rows);
}

/**
 * 保存入渠信息
 */
export async function saveNdocks(ndocks: Ndock[]): Promise<void> {
  const hub = getRepositoryHub();
  const rows = ndocks.map(n => ({
    dockId: n.dockId,
    state: n.state,
    shipUid: n.shipUid,
    completeTime: n.completeTime,
    completeTimeStr: n.completeTimeStr,
    costFuel: n.cost.fuel,
    costSteel: n.cost.steel,
    updatedAt: n.updatedAt,
  }));
  await hub.repair.upsertBatch(rows);
}

/**
 * 获取最新的资源记录
 */
export async function getLatestMaterials(): Promise<Materials | null> {
  const hub = getRepositoryHub();
  const row = await hub.material.getLatest();
  if (!row) return null;

  return {
    fuel: row.fuel,
    ammo: row.ammo,
    steel: row.steel,
    bauxite: row.bauxite,
    instantBuild: row.instantBuild,
    instantRepair: row.instantRepair,
    devMaterial: row.devMaterial,
    screw: row.screw,
    updatedAt: row.updatedAt,
  };
}

/**
 * 获取最新的提督信息
 */
export async function getLatestAdmiral(): Promise<Admiral | null> {
  const hub = getRepositoryHub();
  const row = await hub.admiral.getLatest();
  if (!row) return null;

  return {
    memberId: row.memberId,
    nickname: row.nickname,
    level: row.level,
    experience: row.experience,
    maxShips: row.maxShips,
    maxSlotItems: row.maxSlotItems,
    rank: row.rank,
    largeDockEnabled: row.largeDockEnabled===1?? null,
    updatedAt: row.updatedAt,
  };
}

/**
 * 获取所有舰队
 */
export async function getAllDecks(): Promise<Deck[]> {
  const hub = getRepositoryHub();
  const rows = await hub.deck.list();
  return rows.map(row => ({
    deckId: row.deckId,
    name: row.name,
    shipUids: safeParseJson<number[]>(row.shipUidsJson,[]),
    expedition: {
      deckId: row.deckId,
      progress: row.expeditionProgress,
      missionId: row.expeditionMissionId,
      returnTime: row.expeditionReturnTime,
      updatedAt: row.expeditionUpdatedAt,
    },
    updatedAt: row.updatedAt,
  }));
}
