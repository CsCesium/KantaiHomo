import { Admiral } from './admiral';
import { Deck } from './deck';
import { Kdock } from './k_dock';
import { Materials } from './material';
import { Ndock } from './n_dock';
import type { Ship } from './ship';

export interface PortLog {
  no: number;
  type: string;
  message: string;
  updatedAt: number;
  extras?: Record<string, unknown>;
}

export interface PortSnapshot {
  admiral: Admiral;
  materials: Materials;
  decks: Deck[];
  ndocks: Ndock[];
  kdocks: Kdock[];
  ships: Ship[];
  logs: PortLog[];

  combinedFlag?: number;
  bgmId?: number;
  parallelQuestCount?: number;

  updatedAt: number;
  extras?: Record<string, unknown>;
}