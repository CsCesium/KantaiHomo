import { AdmiralRepositoryDb } from './admiral';
import { ExpeditionRepositoryDb } from './expedition';
import { MaterialsRepositoryDb } from './material';
import { SlotItemRepositoryDb } from './slotitem';
import type { RepositoryHub } from './types';

export function createRepositoryHub(): RepositoryHub {
  return {
    material:new MaterialsRepositoryDb(),
    expedition: new ExpeditionRepositoryDb(),
    admiral:new AdmiralRepositoryDb(),
    slotitem:new SlotItemRepositoryDb(),
  };
}