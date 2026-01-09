import type relationalStore from '@ohos.data.relationalStore';
import type { Migration } from './index';

const m003: Migration = {
  version: 3,
  name: 'add_expedition_results',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS expedition_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deckId INTEGER NOT NULL,
        missionId INTEGER NOT NULL,
        clear INTEGER NOT NULL,
        admiral_lv INTEGER,
        admiral_getExp INTEGER,
        materials TEXT,     -- JSON: [fuel, ammo, steel, bauxite]
        items TEXT,         -- JSON: [{id,count}, ...]
        finishedAt INTEGER NOT NULL
      );
    `);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_exr_time ON expedition_results(finishedAt);`);
  },
};

export default m003;