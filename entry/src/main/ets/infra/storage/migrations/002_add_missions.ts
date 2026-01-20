import type relationalStore from '@ohos.data.relationalStore';
import type { Migration } from './index';

const m002: Migration = {
  version: 1,
  name: 'add_missions_table',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS missions (
        id INTEGER PRIMARY KEY,
        code TEXT,
        mapAreaId INTEGER,
        name TEXT,
        details TEXT,
        resetType TEXT,
        damageType INTEGER,
        timeMin INTEGER,
        requireShips INTEGER,
        difficulty INTEGER,
        fuelPct INTEGER,
        ammoPct INTEGER,
        reward_item1_id INTEGER,
        reward_item1_count INTEGER,
        reward_item2_id INTEGER,
        reward_item2_count INTEGER,
        mat0 INTEGER, mat1 INTEGER, mat2 INTEGER, mat3 INTEGER,
        returnCancelable INTEGER,
        sampleFleet TEXT,
        updatedAt INTEGER
      );
    `);
  },
};

export default m002;