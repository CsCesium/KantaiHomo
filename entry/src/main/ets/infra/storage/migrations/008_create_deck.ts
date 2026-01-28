import { Migration } from ".";
import { relationalStore } from "@kit.ArkData";

const m008: Migration = {
  version: 8,
  name: 'create_decks',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS decks (
        deckId INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        shipUidsJson TEXT NOT NULL,

        expeditionProgress INTEGER NOT NULL,
        expeditionMissionId INTEGER NOT NULL,
        expeditionReturnTime INTEGER NOT NULL,
        expeditionUpdatedAt INTEGER NOT NULL,

        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_decks_updatedAt ON decks(updatedAt);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_decks_expReturnTime ON decks(expeditionReturnTime);`);
  },
};

export default m008;