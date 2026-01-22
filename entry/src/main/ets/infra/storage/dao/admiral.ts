import { int, query, readOne, str, withTransaction } from "../db";
import { relationalStore } from "@kit.ArkData";
import type { AdmiralRow as RepoAdmiralRow } from '../../storage/repo/types';

export type AdmiralRow =
  Omit<RepoAdmiralRow, 'rank' | 'largeDockEnabled' | 'extras'> & {
    rank: number | null;
    largeDockEnabled: number | null;
  };

const mapAdmiral = (rs: relationalStore.ResultSet): AdmiralRow => ({
  memberId: int(rs, 'memberId') ?? 0,
  nickname: str(rs, 'nickname') ?? '',
  level: int(rs, 'level') ?? 0,
  experience: int(rs, 'experience') ?? 0,
  maxShips: int(rs, 'maxShips') ?? 0,
  maxSlotItems: int(rs, 'maxSlotItems') ?? 0,
  rank: int(rs, 'rank') ?? null,
  largeDockEnabled: int(rs, 'largeDockEnabled') ?? null,
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsert(row: AdmiralRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT OR REPLACE INTO admirals
       (memberId, nickname, level, experience, maxShips, maxSlotItems, rank, largeDockEnabled, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.memberId,
        row.nickname,
        row.level,
        row.experience,
        row.maxShips,
        row.maxSlotItems,
        row.rank,
        row.largeDockEnabled,
        row.updatedAt,
      ]
    );
  });
}


export async function getAdmiral(memberId: number): Promise<AdmiralRow | null> {
  const rs = await query(
    `SELECT memberId, nickname, level, experience, maxShips, maxSlotItems, rank, largeDockEnabled, updatedAt
     FROM admirals
     WHERE memberId = ?
     LIMIT 1`,
    [memberId]
  );
  return readOne(rs, mapAdmiral);
}

export async function getLatestAdmiral(): Promise<AdmiralRow | null> {
  const rs = await query(
    `SELECT memberId, nickname, level, experience, maxShips, maxSlotItems, rank, largeDockEnabled, updatedAt
     FROM admirals
     ORDER BY updatedAt DESC
     LIMIT 1`,
    []
  );
  return readOne(rs, mapAdmiral);
}

// Deprecated: each account only have one db file
// export async function listAdmirals(): Promise<AdmiralRow[]> {
//   const rs = await query(
//     `SELECT memberId, nickname, level, experience, maxShips, maxSlotItems, rank, largeDockEnabled, updatedAt
//      FROM admirals ORDER BY memberId ASC`,
//     []
//   );
//   return readRows(rs, mapAdmiral);
// }