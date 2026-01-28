import { Migration } from ".";
import { relationalStore } from "@kit.ArkData";

const m009: Migration = {
  version: 9,
  name: 'create_quests',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS quests (
        questId INTEGER PRIMARY KEY,
        category INTEGER NOT NULL,
        type INTEGER NOT NULL,
        state INTEGER NOT NULL,          -- 0 inactive, 1 active, 2 complete
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        progress INTEGER,               -- nullable
        bonusFlag INTEGER,              -- nullable
        materialsJson TEXT,             -- nullable JSON number[]
        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_quests_state ON quests(state);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_quests_updatedAt ON quests(updatedAt);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_quests_category ON quests(category);`);
  },
};

export default m009;