export enum ExpeditionProgress {
  IDLE = 0,
  RUNNING = 1,
  RETURNED  = 2,
  FORCED_RETURN = 3,
}

export interface MissionStart {
  deckId: number;
  missionId: number;
  complTime: number;         // ms epoch
  complTimeStr: string;
  updatedAt: number;
}

export interface ExpeditionSlotState {
  deckId: number;
  progress: ExpeditionProgress;
  missionId: number;         // 0 表示无远征
  returnTime: number;        // 0 表示无远征/未知
  updatedAt: number;
}

export interface MissionResult {
  deckId: number;
  missionId: number;

  clear: 0 | 1 | 2;

  admiral: { lv: number; exp: number; getExp: number };

  /** 归来舰船实例ID*/
  shipIds: number[];
  shipExp: number[];
  shipExpLvup: number[][];

  drops: {
    materials?: [number, number, number, number]; // [燃, 弾, 鋼, 空]
    items?: Array<{ id: number; name?: string; count: number }>;
  };

  quest: { name: string; level: number; detail?: string; areaName?: string };

  finishedAt: number;
}

export interface MissionCatalogItem {
  id: number;
  code: string; // A1 等
  mapAreaId: number;

  name: string;
  details: string;

  resetType: 'normal' | 'monthly';
  damageType: 0 | 1 | 2;

  timeMin: number;
  requireShips: number;
  difficulty: number;

  costRatio: { fuelPct: number; ammoPct: number };

  reward: {
    winItem1?: { itemId: number; count: number };
    winItem2?: { itemId: number; count: number };
    matLevel?: [number, number, number, number];
  };

  returnCancelable: boolean;
  sampleFleet?: number[];

  updatedAt: number;
}
