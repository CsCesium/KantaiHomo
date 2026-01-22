import { Migration } from ".";
import { relationalStore } from "@kit.ArkData";

const m005: Migration = {
  version: 1,
  name: 'create_materials',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS materials (
        memberId INTEGER PRIMARY KEY,
        fuel INTEGER NOT NULL,
        ammo INTEGER NOT NULL,
        steel INTEGER NOT NULL,
        bauxite INTEGER NOT NULL,
        instantBuild INTEGER NOT NULL,
        instantRepair INTEGER NOT NULL,
        devMaterial INTEGER NOT NULL,
        screw INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_materials_updatedAt ON materials(updatedAt);`);
  },
};

export default m005;