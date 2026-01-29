/**
 * Battle Mapper - BattleRecord/SortieRecord ↔ Row 转换
 */
import { safeParseJson } from "..";
import { BattleRecordRow, SortieRecordRow } from "../../../infra/storage/types";
import {
  BattleRecord,
  FleetSnapshot,
  EnemyFleetInfo,
  AirBaseSnapshot,
  BattleHpSnapshot,
  SortieRecord
} from "../struct";


// ==================== BattleRecord ====================

export function battleRecordToRow(record: BattleRecord): BattleRecordRow {
  return {
    id: record.id,
    sortieId: record.sortieId,

    mapAreaId: record.mapAreaId,
    mapInfoNo: record.mapInfoNo,
    cellId: record.cellId,
    cellEventId: record.cellEventId,
    isBoss: record.isBoss ? 1 : 0,

    battleType: record.battleType,
    isPractice: record.isPractice ? 1 : 0,

    friendFormation: record.friendFormation ?? null,
    enemyFormation: record.enemyFormation ?? null,
    engagement: record.engagement ?? null,
    airState: record.airState ?? null,

    friendFleetJson: JSON.stringify(record.friendFleet),
    friendFleetEscortJson: record.friendFleetEscort ? JSON.stringify(record.friendFleetEscort) : null,
    enemyFleetJson: JSON.stringify(record.enemyFleet),
    enemyFleetEscortJson: record.enemyFleetEscort ? JSON.stringify(record.enemyFleetEscort) : null,
    airBasesJson: record.airBases ? JSON.stringify(record.airBases) : null,
    hpStartJson: JSON.stringify(record.hpStart),
    hpEndJson: JSON.stringify(record.hpEnd),

    rank: record.rank,
    mvp: record.mvp ?? null,
    mvpCombined: record.mvpCombined ?? null,
    dropShipId: record.dropShipId ?? null,
    dropShipName: record.dropShipName ?? null,
    dropItemId: record.dropItemId ?? null,
    baseExp: record.baseExp ?? null,

    startedAt: record.startedAt,
    endedAt: record.endedAt,
    createdAt: Date.now(),
  };
}

export function rowToBattleRecord(row: BattleRecordRow): BattleRecord {
  return {
    id: row.id,
    sortieId: row.sortieId,

    mapAreaId: row.mapAreaId,
    mapInfoNo: row.mapInfoNo,
    cellId: row.cellId,
    cellEventId: row.cellEventId,
    isBoss: row.isBoss === 1,

    battleType: row.battleType as any,
    isPractice: row.isPractice === 1,

    friendFormation: row.friendFormation ?? undefined,
    enemyFormation: row.enemyFormation ?? undefined,
    engagement: row.engagement ?? undefined,
    airState: row.airState ?? undefined,

    friendFleet: safeParseJson<FleetSnapshot>(row.friendFleetJson, defaultFleetSnapshot()),
    friendFleetEscort: row.friendFleetEscortJson
      ? safeParseJson<FleetSnapshot>(row.friendFleetEscortJson, undefined)
      : undefined,
    enemyFleet: safeParseJson<EnemyFleetInfo>(row.enemyFleetJson, defaultEnemyFleet()),
    enemyFleetEscort: row.enemyFleetEscortJson
      ? safeParseJson<EnemyFleetInfo>(row.enemyFleetEscortJson, undefined)
      : undefined,
    airBases: row.airBasesJson
      ? safeParseJson<AirBaseSnapshot[]>(row.airBasesJson, undefined)
      : undefined,
    hpStart: safeParseJson<BattleHpSnapshot>(row.hpStartJson, defaultHpSnapshot()),
    hpEnd: safeParseJson<BattleHpSnapshot>(row.hpEndJson, defaultHpSnapshot()),

    rank: row.rank,
    mvp: row.mvp ?? undefined,
    mvpCombined: row.mvpCombined ?? undefined,
    dropShipId: row.dropShipId ?? undefined,
    dropShipName: row.dropShipName ?? undefined,
    dropItemId: row.dropItemId ?? undefined,
    baseExp: row.baseExp ?? undefined,

    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

// ==================== SortieRecord ====================

export function sortieRecordToRow(record: SortieRecord): SortieRecordRow {
  return {
    id: record.id,

    mapAreaId: record.mapAreaId,
    mapInfoNo: record.mapInfoNo,
    deckId: record.deckId,
    combinedType: record.combinedType,

    fleetSnapshotJson: JSON.stringify(record.fleetSnapshot),
    fleetSnapshotEscortJson: record.fleetSnapshotEscort
      ? JSON.stringify(record.fleetSnapshotEscort)
      : null,

    routeJson: JSON.stringify(record.route),

    result: record.result,
    bossReached: record.bossReached ? 1 : 0,
    bossKilled: record.bossKilled ? 1 : 0,

    fuelUsed: record.fuelUsed,
    ammoUsed: record.ammoUsed,

    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    createdAt: Date.now(),
  };
}

export function rowToSortieRecord(row: SortieRecordRow): SortieRecord {
  return {
    id: row.id,

    mapAreaId: row.mapAreaId,
    mapInfoNo: row.mapInfoNo,
    deckId: row.deckId,
    combinedType: row.combinedType,

    fleetSnapshot: safeParseJson<FleetSnapshot>(row.fleetSnapshotJson, defaultFleetSnapshot()),
    fleetSnapshotEscort: row.fleetSnapshotEscortJson
      ? safeParseJson<FleetSnapshot>(row.fleetSnapshotEscortJson, undefined)
      : undefined,

    route: safeParseJson<number[]>(row.routeJson, []),

    result: row.result as any,
    bossReached: row.bossReached === 1,
    bossKilled: row.bossKilled === 1,

    fuelUsed: row.fuelUsed,
    ammoUsed: row.ammoUsed,

    startedAt: row.startedAt,
    endedAt: row.endedAt ?? undefined,
  };
}

// ==================== Batch ====================

export function battleRecordsToRows(records: readonly BattleRecord[]): BattleRecordRow[] {
  return records.map(battleRecordToRow);
}

export function rowsToBattleRecords(rows: readonly BattleRecordRow[]): BattleRecord[] {
  return rows.map(rowToBattleRecord);
}

export function sortieRecordsToRows(records: readonly SortieRecord[]): SortieRecordRow[] {
  return records.map(sortieRecordToRow);
}

export function rowsToSortieRecords(rows: readonly SortieRecordRow[]): SortieRecord[] {
  return rows.map(rowToSortieRecord);
}

// ==================== Helpers ====================

function defaultFleetSnapshot(): FleetSnapshot {
  return {
    deckId: 0,
    name: '',
    ships: [],
    capturedAt: 0,
  };
}

function defaultEnemyFleet(): EnemyFleetInfo {
  return {
    shipIds: [],
    levels: [],
    hpNow: [],
    hpMax: [],
  };
}

function defaultHpSnapshot(): BattleHpSnapshot {
  return {
    friend: { main: { now: [], max: [] } },
    enemy: { main: { now: [], max: [] } },
  };
}
