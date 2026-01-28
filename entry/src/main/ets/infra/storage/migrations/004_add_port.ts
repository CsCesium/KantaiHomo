import { Migration } from '.'
import { relationalStore } from '@kit.ArkData';

const m004: Migration = {
  version: 4,
  name: 'create_admirals',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS admirals (
        memberId INTEGER PRIMARY KEY,
        nickname TEXT NOT NULL,
        level INTEGER NOT NULL,
        experience INTEGER NOT NULL,
        maxShips INTEGER NOT NULL,
        maxSlotItems INTEGER NOT NULL,
        rank INTEGER,
        largeDockEnabled INTEGER, -- 0/1
        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_admirals_updatedAt ON admirals(updatedAt);`);
  },
};

export default m004;