export enum ExpeditionProgress {
  IDLE = 0,
  RUNNING = 1,
  RETURNABLE = 2,
  FORCED_RETURN = 3,
}

export type ApiDeckMissionTuple = [state: number, missionId: number, returnTimeMs: number, reserved: number];

export interface ApiMissionStartRespRaw {
  api_complatetime: number;         // 归投时间，unitime（ms）注意 compla*
  api_complatetime_str: string;     // 归投时间
}

export interface MissionStart {
  deckId: number;
  missionId: number;
  complTime: number;
  complTimeStr: string;
  updatedAt: number;
}

export interface ExpeditionSlotState {
  deckId: number;                   // 舰队
  progress: ExpeditionProgress;     // 0/1/2/3
  missionId: number;                // 远征ID
  returnTime: number;          // 归投时间戳；0 表示未出击
  updatedAt: number;
}

export interface ApiMissionResultRespRaw {
  api_ship_id: number[];            // 归来舰船ID（可变长）
  api_clear_result: 0|1|2;          // 0失败 1成功 2大成功
  api_get_exp: number;              // 提督经验
  api_member_lv: number;
  api_member_exp: number;
  api_get_ship_exp: number[];       // 各舰所得经验
  api_get_exp_lvup: number[][];     // 各舰 [当前经验, 下级所需]（Lv99/155 时 -1）
  api_maparea_name: string;
  api_detail: string;
  api_quest_name: string;
  api_quest_level: number;
  api_get_material?: number[];      // 资源数组，不存在时 -1（或无字段）
  api_useitem_flag: number[];       // 0=无; 1=桶; 2=建造; 3=开发; 4=道具; 5=家具币
  api_get_item1?: { api_useitem_id: number; api_useitem_name: string | null; api_useitem_count: number };
  api_get_item2?: { api_useitem_id: number; api_useitem_name: string | null; api_useitem_count: number };
}
export interface MissionResult {
  deckId: number;
  missionId: number;
  clear: 0|1|2;
  admiral: { lv: number; exp: number; getExp: number };
  shipIds: number[];
  shipExp: number[];                // 与 shipIds 对齐
  shipExpLvup: number[][];
  drops: {
    materials?: number[];           // [燃, 弾, 鋼, 空]
    items?: Array<{ id: number; name?: string; count: number }>;
  };
  quest: { name: string; level: number; detail?: string; areaName?: string };
  finishedAt: number;
}

export interface ApiMissionCatalogRaw {
  api_id: number;
  api_disp_no: string;
  api_maparea_id: number;
  api_name: string;
  api_details: string;
  api_reset_type: 0|1;              // 0=通常 1=月常
  api_damage_type: 0|1|2;
  api_time: number;                  // 分
  api_deck_num: number;              // 需要舰船数
  api_difficulty: number;
  api_use_fuel: number;              // 燃料消耗比例（百分比）
  api_use_bull: number;              // 弹药消耗比例（百分比）
  api_win_item1?: [number, number];  // [itemId, count]
  api_win_item2?: [number, number];
  api_win_mat_level?: [number, number, number, number]; // 资源量等级 0~4
  api_return_flag?: 0|1;             // 是否可中止
  api_sample_fleet?: number[];       // [6] 艦種ID（0=空）
}

export interface MissionCatalogItem {
  id: number;
  code: string;                      // A1 等
  mapAreaId: number;
  name: string;
  details: string;
  resetType: 'normal'|'monthly';
  damageType: 0|1|2;
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
  sampleFleet?: number[];            // 艦種ID
  updatedAt: number;
}

/** —— Normalize —— */
export function normalizeMissionStart(deckId: number, missionId: number, raw: ApiMissionStartRespRaw): MissionStart {
  return {
    deckId,
    missionId,
    complTime: raw.api_complatetime,
    complTimeStr: raw.api_complatetime_str,
    updatedAt: Date.now(),
  };
}

export function normalizeDeckMission(deckId: number, tuple: ApiDeckMissionTuple): ExpeditionSlotState {
  const [state, missionId, returnMs] = tuple;
  return {
    deckId,
    progress: state as ExpeditionProgress,
    missionId,
    returnTime: returnMs,
    updatedAt: Date.now(),
  };
}

export function normalizeMissionResult(
  deckId: number,
  missionId: number,
  raw: ApiMissionResultRespRaw
): MissionResult {
  const items: Array<{ id: number; name?: string; count: number }> = [];
  if (raw.api_useitem_flag?.[0] && raw.api_get_item1) {
    items.push({ id: raw.api_get_item1.api_useitem_id, name: raw.api_get_item1.api_useitem_name ?? undefined, count: raw.api_get_item1.api_useitem_count });
  }
  if (raw.api_useitem_flag?.[1] && raw.api_get_item2) {
    items.push({ id: raw.api_get_item2.api_useitem_id, name: raw.api_get_item2.api_useitem_name ?? undefined, count: raw.api_get_item2.api_useitem_count });
  }
  return {
    deckId,
    missionId,
    clear: raw.api_clear_result,
    admiral: { lv: raw.api_member_lv, exp: raw.api_member_exp, getExp: raw.api_get_exp },
    shipIds: raw.api_ship_id ?? [],
    shipExp: raw.api_get_ship_exp ?? [],
    shipExpLvup: raw.api_get_exp_lvup ?? [],
    drops: {
      materials: raw.api_get_material && raw.api_get_material[0] !== -1 ? raw.api_get_material : undefined,
      items: items.length ? items : undefined,
    },
    quest: {
      name: raw.api_quest_name,
      level: raw.api_quest_level,
      detail: raw.api_detail,
      areaName: raw.api_maparea_name,
    },
    finishedAt: Date.now(),
  };
}

export function normalizeMissionCatalog(raw: ApiMissionCatalogRaw): MissionCatalogItem {
  const item = (arr?: [number, number]) => (arr ? { itemId: arr[0], count: arr[1] } : undefined);
  return {
    id: raw.api_id,
    code: raw.api_disp_no,
    mapAreaId: raw.api_maparea_id,
    name: raw.api_name,
    details: raw.api_details,
    resetType: raw.api_reset_type === 1 ? 'monthly' : 'normal',
    damageType: raw.api_damage_type,
    timeMin: raw.api_time,
    requireShips: raw.api_deck_num,
    difficulty: raw.api_difficulty,
    costRatio: { fuelPct: raw.api_use_fuel, ammoPct: raw.api_use_bull },
    reward: {
      winItem1: item(raw.api_win_item1),
      winItem2: item(raw.api_win_item2),
      matLevel: raw.api_win_mat_level,
    },
    returnCancelable: raw.api_return_flag === 1,
    sampleFleet: raw.api_sample_fleet,
    updatedAt: Date.now(),
  };
}