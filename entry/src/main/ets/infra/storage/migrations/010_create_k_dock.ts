import { Migration } from ".";
import { relationalStore } from "@kit.ArkData";

const m010: Migration = {
  version: 10,
  name: 'create_kdocks',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS kdocks (
        dockId INTEGER PRIMARY KEY,
        state INTEGER NOT NULL,

        createdShipMasterId INTEGER NOT NULL,

        completeTime INTEGER NOT NULL,
        completeTimeStr TEXT NOT NULL,

        costFuel INTEGER NOT NULL,
        costAmmo INTEGER NOT NULL,
        costSteel INTEGER NOT NULL,
        costBauxite INTEGER NOT NULL,
        costDev INTEGER NOT NULL,

        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_kdocks_updatedAt ON kdocks(updatedAt);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_kdocks_completeTime ON kdocks(completeTime);`);
  },
};

export default m010;