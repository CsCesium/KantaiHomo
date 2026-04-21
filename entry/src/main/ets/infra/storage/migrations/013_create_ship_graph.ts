import type relationalStore from '@ohos.data.relationalStore';
import { Migration } from '.';

const m013: Migration = {
  version: 13,
  name: 'create_ship_graph_mst',

  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS ship_graph_mst (
        id        INTEGER PRIMARY KEY,
        filename  TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
  },

  async down(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql('DROP TABLE IF EXISTS ship_graph_mst;');
  },
};

export default m013;
