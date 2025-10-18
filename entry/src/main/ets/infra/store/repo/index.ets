import { ExpeditionRepositoryDb } from './ExpeditionRepo';
import type { RepositoryHub } from './types';

export function createRepositoryHub(): RepositoryHub {
  return {
    expedition: new ExpeditionRepositoryDb()
  };
}