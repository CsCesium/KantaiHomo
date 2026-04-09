import { Migration } from ".";
import type relationalStore from '@ohos.data.relationalStore';

const m005: Migration = {
  version: 5,
  name: 'create_materials',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS materials_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_mat_updatedAt ON materials_history(updatedAt);`);
  },
};

export default m005;