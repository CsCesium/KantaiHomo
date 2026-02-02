/**
 * Admiral Mapper - Struct <-> Row 转换
 */

import type { Admiral } from '../struct/admiral';
import type { AdmiralRow } from '../../../infra/storage/types';

export function admiralToRow(a: Admiral): AdmiralRow {
  return {
    memberId: a.memberId,
    nickname: a.nickname,
    level: a.level,
    experience: a.experience,
    maxShips: a.maxShips,
    maxSlotItems: a.maxSlotItems,
    rank: a.rank ?? null,
    largeDockEnabled: a.largeDockEnabled ? 1 : 0,
    updatedAt: a.updatedAt,
  };
}

export function rowToAdmiral(row: AdmiralRow): Admiral {
  return {
    memberId: row.memberId,
    nickname: row.nickname,
    level: row.level,
    experience: row.experience,
    maxShips: row.maxShips,
    maxSlotItems: row.maxSlotItems,
    rank: row.rank ?? undefined,
    largeDockEnabled: row.largeDockEnabled === 1,
    updatedAt: row.updatedAt,
  };
}