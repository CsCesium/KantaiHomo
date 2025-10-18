//src/main/ets/infra/store/db.ts
import relationalStore from '@ohos.data.relationalStore';
import {getAppContext}from '../appContext'
import { migrations, type Migration } from './migrations';

type RdbStore = relationalStore.RdbStore;
type ResultSet = relationalStore.ResultSet;

const DB_NAME = 'KantaiHomo.db';
let store: RdbStore | null = null;



export async function getDB(): Promise<RdbStore> {
  if (store) {
    return store;
  }

  const config: relationalStore.StoreConfig = {
    name: DB_NAME,
    securityLevel: relationalStore.SecurityLevel.S1,
  };

  store = await relationalStore.getRdbStore(getAppContext(), config);
  await runMigrations(store);
  return store;
}

async function runMigrations(db: RdbStore): Promise<void> {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT,
      appliedAt INTEGER
    );
  `);

  const done = new Set<number>();
  const rs = await db.querySql(`SELECT version FROM schema_migrations`, []);
  try {
    while (rs.goToNextRow()) {
      done.add(Number(rs.getLong(0))); // 按索引读
    }
  } finally {
    rs.close();
  }
  for (const m of migrations as Migration[]) {
    if (done.has(m.version)) {
      continue;
    }

    await db.beginTransaction();
    try {
      await m.up(db);
      await db.executeSql(
        `INSERT INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)`,
        [m.version, m.name, Date.now()]
      );
      await db.commit();
      console.info(`[DB] migration applied: v${m.version} ${m.name}`);
    } catch (e) {
      await db.rollBack();
      console.error(`[DB] migration FAILED: v${m.version} ${m.name}`, `${e}`);
      throw e; // 中止启动，避免半升级
    }
  }
}

export function col(rs: ResultSet, name: string): number {
  const idx = rs.getColumnIndex(name);
  if (idx < 0) {
    throw new Error(`[DB] Column not found: ${name}`);
  }
  return idx;
}

export function isNull(rs: ResultSet, name: string): boolean {
  return rs.isColumnNull(col(rs, name));
}

export function str(rs: ResultSet, name: string): string | null {
  if (isNull(rs, name)) {
    return null;
  }
  return rs.getString(col(rs, name));
}

export function int(rs: ResultSet, name: string): number | null {
  if (isNull(rs, name)) {
    return null;
  }
  return Number(rs.getLong(col(rs, name)));
}

export function dbl(rs: ResultSet, name: string): number | null {
  if (isNull(rs, name)) {
    return null;
  }
  return Number(rs.getDouble(col(rs, name)));
}

export function readRows<T>(rs: ResultSet, map: (row: ResultSet) => T): T[] {
  const out: T[] = [];
  try {
    while (rs.goToNextRow()) {
      out.push(map(rs));
    }
  } finally {
    rs.close();
  }
  return out;
}

export function readOne<T>(rs: ResultSet, map: (row: ResultSet) => T): T | null {
  try {
    if (rs.goToNextRow()) {
      return map(rs);
    }
    return null;
  } finally {
    rs.close();
  }
}

export async function exec(sql: string, args: ReadonlyArray<number | string | null> = []): Promise<void> {
  const db = await getDB();
  await db.executeSql(sql, args as (number | string | Uint8Array | null)[]);
}

export async function query(sql: string, args: ReadonlyArray<number | string | null> = []): Promise<ResultSet> {
  const db = await getDB();
  return db.querySql(sql, args as (number | string | Uint8Array | null)[]);
}

export async function withTransaction<T>(fn: (db: RdbStore) => Promise<T>): Promise<T> {
  const db = await getDB();
  await db.beginTransaction();
  try {
    const ret = await fn(db);
    await db.commit();
    return ret;
  } catch (e) {
    await db.rollBack();
    throw e;
  }
}
