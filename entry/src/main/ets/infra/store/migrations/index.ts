import type relationalStore from '@ohos.data.relationalStore';

export interface Migration {
  version: number;
  name: string;
  up(db: relationalStore.RdbStore): Promise<void>;
}

export { default as m001_init_core } from './001_init_core';
export { default as m002_add_missions } from './002_add_missions';
export { default as m003_add_expedition_results } from './003_add_expedition_results';

export const migrations: Migration[] = [
// 基础
// @ts-ignore
  (await import('./001_init_core')).default,
  // @ts-ignore
  (await import('./002_add_missions')).default,
  // @ts-ignore
  (await import('./003_add_expedition_results')).default,
  // @ts-ignore
  //(await import('./004_exp_add_serverName')).default,
];