import type relationalStore from '@ohos.data.relationalStore';
import type { Migration } from './index';

const m001: Migration = {
  version: 1,
  name: 'init_core_tables',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS expeditions (
        deckId INTEGER PRIMARY KEY,
        missionId INTEGER NOT NULL,
        progress INTEGER NOT NULL,
        returnTime INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ex_return ON expeditions(returnTime);`);
  },
};

export default m001;