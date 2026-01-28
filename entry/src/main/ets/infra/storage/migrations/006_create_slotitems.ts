import { Migration } from ".";
import { relationalStore } from "@kit.ArkData";

const m006: Migration = {
  version: 6,
  name: 'create_slotitems',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS slotitem_mst (
        id INTEGER PRIMARY KEY,
        sortNo INTEGER NOT NULL,
        name TEXT NOT NULL,

        typeMajor INTEGER NOT NULL,
        typeBook INTEGER NOT NULL,
        typeEquipType INTEGER NOT NULL,
        typeIconId INTEGER NOT NULL,
        typeAircraft INTEGER NOT NULL,

        rarity INTEGER NOT NULL,
        range INTEGER NOT NULL,

        stat_hp INTEGER NOT NULL,
        stat_armor INTEGER NOT NULL,
        stat_firepower INTEGER NOT NULL,
        stat_torpedo INTEGER NOT NULL,
        stat_speed INTEGER NOT NULL,
        stat_bomb INTEGER NOT NULL,
        stat_aa INTEGER NOT NULL,
        stat_asw INTEGER NOT NULL,
        stat_hit INTEGER NOT NULL,
        stat_evasion INTEGER NOT NULL,
        stat_los INTEGER NOT NULL,
        stat_luck INTEGER NOT NULL,

        broken_fuel INTEGER NOT NULL,
        broken_ammo INTEGER NOT NULL,
        broken_steel INTEGER NOT NULL,
        broken_bauxite INTEGER NOT NULL,

        cost INTEGER,
        distance INTEGER,
        useBull INTEGER,
        gfxVersion INTEGER,

        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_slotitem_mst_icon ON slotitem_mst(typeIconId);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_slotitem_mst_updatedAt ON slotitem_mst(updatedAt);`);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS slotitems (
        uid INTEGER PRIMARY KEY,
        masterId INTEGER NOT NULL,
        locked INTEGER NOT NULL,
        level INTEGER,
        alv INTEGER,
        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_slotitems_masterId ON slotitems(masterId);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_slotitems_updatedAt ON slotitems(updatedAt);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_slotitems_locked ON slotitems(locked);`);
  },
};

export default m006;