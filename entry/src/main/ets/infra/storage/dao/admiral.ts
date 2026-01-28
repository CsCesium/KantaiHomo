import { int, str, withTransaction, query, readOne } from "../db";
import { AdmiralRow } from "../types";
import { relationalStore } from "@kit.ArkData";

const mapRow = (rs: relationalStore.ResultSet): AdmiralRow => ({
  memberId: int(rs, 'memberId') ?? 0,
  nickname: str(rs, 'nickname') ?? '',
  level: int(rs, 'level') ?? 0,
  experience: int(rs, 'experience') ?? 0,
  maxShips: int(rs, 'maxShips') ?? 0,
  maxSlotItems: int(rs, 'maxSlotItems') ?? 0,
  rank: int(rs, 'rank'),
  largeDockEnabled: int(rs, 'largeDockEnabled'),
  updatedAt: int(rs, 'updatedAt') ?? 0,
});

export async function upsert(row: AdmiralRow): Promise<void> {
  await withTransaction(async (db) => {
    await db.executeSql(
      `INSERT OR REPLACE INTO admirals
       (memberId, nickname, level, experience, maxShips, maxSlotItems, rank, largeDockEnabled, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.memberId, row.nickname, row.level, row.experience,
        row.maxShips, row.maxSlotItems, row.rank, row.largeDockEnabled, row.updatedAt,
      ]
    );
  });
}

export async function get(memberId: number): Promise<AdmiralRow | null> {
  const rs = await query(`SELECT * FROM admirals WHERE memberId = ? LIMIT 1`, [memberId]);
  return readOne(rs, mapRow);
}

export async function getLatest(): Promise<AdmiralRow | null> {
  const rs = await query(`SELECT * FROM admirals ORDER BY updatedAt DESC LIMIT 1`, []);
  return readOne(rs, mapRow);
}
