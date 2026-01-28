import { Migration } from ".";
import { relationalStore } from "@kit.ArkData";

const m011: Migration = {
  version: 11,
  name: 'create_ndocks',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS ndocks (
        dockId INTEGER PRIMARY KEY,
        state INTEGER NOT NULL,
        shipUid INTEGER NOT NULL,

        completeTime INTEGER NOT NULL,
        completeTimeStr TEXT,

        costFuel INTEGER NOT NULL,
        costSteel INTEGER NOT NULL,

        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ndocks_updatedAt ON ndocks(updatedAt);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ndocks_completeTime ON ndocks(completeTime);`);
  },
};

export default m011;