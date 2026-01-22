import type relationalStore from '@ohos.data.relationalStore';
import { Migration } from '.';

const m007: Migration = {
  version: 1,
  name: 'create_ships',
  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS ship_mst (
        id INTEGER PRIMARY KEY,
        sortNo INTEGER NOT NULL,
        name TEXT NOT NULL,

        stype INTEGER,
        ctype INTEGER,
        speed INTEGER,
        range INTEGER,
        slotNum INTEGER,

        maxEqJson TEXT,
        afterLv INTEGER,
        afterShipId INTEGER,

        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ship_mst_sortNo ON ship_mst(sortNo);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ship_mst_updatedAt ON ship_mst(updatedAt);`);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS ships (
        uid INTEGER PRIMARY KEY,
        sortNo INTEGER NOT NULL,
        masterId INTEGER NOT NULL,

        level INTEGER NOT NULL,
        expTotal INTEGER NOT NULL,
        expToNext INTEGER NOT NULL,
        expGauge INTEGER NOT NULL,

        nowHp INTEGER NOT NULL,
        maxHp INTEGER NOT NULL,
        speed INTEGER NOT NULL,
        range INTEGER NOT NULL,

        slotsJson TEXT NOT NULL,
        onslotJson TEXT NOT NULL,
        slotEx INTEGER NOT NULL,

        modern_fp INTEGER NOT NULL,
        modern_tp INTEGER NOT NULL,
        modern_aa INTEGER NOT NULL,
        modern_ar INTEGER NOT NULL,
        modern_luck INTEGER NOT NULL,
        modern_hp INTEGER NOT NULL,
        modern_asw INTEGER NOT NULL,

        backs INTEGER NOT NULL,
        fuel INTEGER NOT NULL,
        bull INTEGER NOT NULL,
        slotnum INTEGER NOT NULL,

        ndockTime INTEGER NOT NULL,
        ndockFuel INTEGER NOT NULL,
        ndockSteel INTEGER NOT NULL,

        srate INTEGER NOT NULL,
        cond INTEGER NOT NULL,

        fp_cur INTEGER NOT NULL, fp_max INTEGER NOT NULL,
        tp_cur INTEGER NOT NULL, tp_max INTEGER NOT NULL,
        aa_cur INTEGER NOT NULL, aa_max INTEGER NOT NULL,
        ar_cur INTEGER NOT NULL, ar_max INTEGER NOT NULL,
        ev_cur INTEGER NOT NULL, ev_max INTEGER NOT NULL,
        asw_cur INTEGER NOT NULL, asw_max INTEGER NOT NULL,
        sc_cur INTEGER NOT NULL, sc_max INTEGER NOT NULL,
        luck_cur INTEGER NOT NULL, luck_max INTEGER NOT NULL,

        locked INTEGER NOT NULL,
        lockedEquip INTEGER NOT NULL,
        sallyArea INTEGER,

        updatedAt INTEGER NOT NULL
      );
    `);

    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ships_masterId ON ships(masterId);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ships_level ON ships(level);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ships_cond ON ships(cond);`);
    await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_ships_updatedAt ON ships(updatedAt);`);
  },
};

export default m007;