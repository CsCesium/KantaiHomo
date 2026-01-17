//src/main/ets/infra/store/db.ts
import relationalStore from '@ohos.data.relationalStore';
import {getAppContext}from '../appContext'
import { migrations, type Migration } from './migrations';

type RdbStore = relationalStore.RdbStore;
type ResultSet = relationalStore.ResultSet;

const DB_PREFIX = 'KantaiHomo';
let store: RdbStore | null = null;
let activeUserKey: string = 'default';
let openedDbName: string | null = null;

function sanitizeUserKey(userKey: string): string {
  const s = (userKey ?? '').trim().replace(/[^0-9a-zA-Z_-]/g, '_');
  return s.length > 0 ? s.slice(0, 64) : 'default';
}

function dbNameForUser(userKey: string): string {
  const k = sanitizeUserKey(userKey);
  return `${DB_PREFIX}_${k}.db`;
}

export async function setActiveUser(userKey: string): Promise<void> {
  const nextKey = sanitizeUserKey(userKey);
  if (nextKey === activeUserKey && store) return;

  await closeDB();

  activeUserKey = nextKey;
}

export async function resetToDefaultUser(): Promise<void> {
  await setActiveUser('default');
}

export async function getDB(): Promise<RdbStore> {
  const ctx = getAppContext();
  if (!ctx) {
    throw new Error('[DB] AppContext is not initialized (getAppContext() returned null/undefined).');
  }

  const dbName = dbNameForUser(activeUserKey);

  if (store && openedDbName === dbName) return store;

  // 若 store 不为空但名字不对，关掉
  if (store) {
    await closeDB();
  }

  const config: relationalStore.StoreConfig = {
    name: dbName,
    securityLevel: relationalStore.SecurityLevel.S1,
  };

  store = await relationalStore.getRdbStore(ctx, config);
  openedDbName = dbName;
  await runMigrations(store);
  return store;
}

export async function closeDB(): Promise<void> {
  if (!store) return;
  try {
    await store.close(); //close() :contentReference[oaicite:3]{index=3}
  } finally {
    store = null;
    openedDbName = null;
  }
}

export async function deleteUserDB(userKey: string): Promise<void> {
  const ctx = getAppContext();
  if (!ctx) throw new Error('[DB] AppContext is not initialized.');

  const dbName = dbNameForUser(userKey);

  // 如果正在用这个库，先关
  if (openedDbName === dbName) {
    await closeDB();
  }

  await new Promise<void>((resolve, reject) => {
    relationalStore.deleteRdbStore(ctx, dbName, (err) => { // deleteRdbStore 示例见文档 :contentReference[oaicite:4]{index=4}
      if (err) reject(err);
      else resolve();
    });
  });
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

/**     tools       */
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
