/**
 * Migration 012: 创建战斗和出击记录表
 */

import { relationalStore } from '@kit.ArkData';
import { Migration } from '.';

const m012: Migration = {
  version: 12,
  name: 'add_sortie_and_battle_records',

  async up(db: relationalStore.RdbStore): Promise<void> {
    // 出击记录表
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sortie_records (
        id TEXT PRIMARY KEY,

        mapAreaId INTEGER NOT NULL,
        mapInfoNo INTEGER NOT NULL,
        deckId INTEGER NOT NULL,
        combinedType INTEGER NOT NULL DEFAULT 0,

        fleetSnapshotJson TEXT NOT NULL,
        fleetSnapshotEscortJson TEXT,

        routeJson TEXT NOT NULL DEFAULT '[]',

        result TEXT NOT NULL DEFAULT 'ongoing',
        bossReached INTEGER NOT NULL DEFAULT 0,
        bossKilled INTEGER NOT NULL DEFAULT 0,

        fuelUsed INTEGER NOT NULL DEFAULT 0,
        ammoUsed INTEGER NOT NULL DEFAULT 0,

        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        createdAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_sortie_map ON sortie_records(mapAreaId, mapInfoNo);`
    );
    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_sortie_time ON sortie_records(startedAt DESC);`
    );

    // 战斗记录表
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS battle_records (
        id TEXT PRIMARY KEY,
        sortieId TEXT NOT NULL,

        mapAreaId INTEGER NOT NULL,
        mapInfoNo INTEGER NOT NULL,
        cellId INTEGER NOT NULL,
        cellEventId INTEGER NOT NULL,
        isBoss INTEGER NOT NULL DEFAULT 0,

        battleType TEXT NOT NULL,
        isPractice INTEGER NOT NULL DEFAULT 0,

        friendFormation INTEGER,
        enemyFormation INTEGER,
        engagement INTEGER,
        airState INTEGER,

        friendFleetJson TEXT NOT NULL,
        friendFleetEscortJson TEXT,
        enemyFleetJson TEXT NOT NULL,
        enemyFleetEscortJson TEXT,
        airBasesJson TEXT,
        hpStartJson TEXT NOT NULL,
        hpEndJson TEXT NOT NULL,

        rank TEXT NOT NULL,
        mvp INTEGER,
        mvpCombined INTEGER,
        dropShipId INTEGER,
        dropShipName TEXT,
        dropItemId INTEGER,
        baseExp INTEGER,

        startedAt INTEGER NOT NULL,
        endedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_battle_sortie ON battle_records(sortieId);`
    );
    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_battle_map ON battle_records(mapAreaId, mapInfoNo);`
    );
    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_battle_time ON battle_records(startedAt DESC);`
    );
  },

  async down(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`DROP TABLE IF EXISTS battle_records;`);
    await db.executeSql(`DROP TABLE IF EXISTS sortie_records;`);
  },
};

export default m012;