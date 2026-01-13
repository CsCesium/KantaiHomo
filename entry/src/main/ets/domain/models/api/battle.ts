/**
 * Battle-related raw API typings (Kancolle /kcsapi).
 * Keep ALL battle-ish payloads here for easy maintenance.
 *
 * Covered endpoints (requested):
 * - api_req_practice/battle
 * - api_req_practice/midnight_battle
 * - api_req_battle_midnight/battle
 * - api_req_battle_midnight/sp_midnight
 * - api_req_sortie/battle
 * - api_req_sortie/airbattle
 * - api_req_sortie/battle_water
 * - api_req_battle_midnight/battle
 * - api_req_battle_midnight/sp_midnight
 * - api_req_combined_battle/* (battle, midnight_battle, ec_battle, ec_midnight_battle, airbattle, ld_airbattle, battle_water, each_battle, ec_night_to_day, ld_shooting, sp_midnight ...)
 * - api_destruction_battle (embedded in api_req_map/next)
 */
import { ApiFlagArray, ApiFormationRaw, ApiHpArray, ApiNumArray } from "../common";

export interface ApiBasicBattleFrameRaw extends Partial<ApiFormationRaw> {
  api_deck_id?: number;

  /** Friend HPs (often length 7 with dummy at [0]) */
  api_f_nowhps?: ApiHpArray;
  api_f_maxhps?: ApiHpArray;

  /** Friend escort (combined) */
  api_f_nowhps_combined?: ApiHpArray;
  api_f_maxhps_combined?: ApiHpArray;

  /** Enemy HPs */
  api_e_nowhps?: ApiHpArray;
  api_e_maxhps?: ApiHpArray;

  /** Enemy escort (combined enemy) */
  api_e_nowhps_combined?: ApiHpArray;
  api_e_maxhps_combined?: ApiHpArray;

  /** Enemy master ids / levels */
  api_ship_ke?: ApiNumArray;
  api_ship_lv?: ApiNumArray;

  api_ship_ke_combined?: ApiNumArray;
  api_ship_lv_combined?: ApiNumArray;

  /** Slots / params may exist (helpful for later advanced UI) */
  api_eSlot?: number[][];
  api_eParam?: number[][];
  api_eSlot_combined?: number[][];
  api_eParam_combined?: number[][];
  api_fParam?: number[][];
  api_fParam_combined?: number[][];
}
/** ---------- Air battle (kouku) ---------- */
export interface ApiStage1Raw {
  api_f_count: number;
  api_f_lostcount: number;
  api_e_count: number;
  api_e_lostcount: number;
  api_disp_seiku: number;
  api_touch_plane: number[]; // [-1, -1] etc
}

export interface ApiAirFireRaw {
  api_idx: number;
  api_kind: number;
  api_use_items: number[];
}

export interface ApiStage2Raw {
  api_f_count: number;
  api_f_lostcount: number;
  api_e_count: number;
  api_e_lostcount: number;
  api_air_fire?: ApiAirFireRaw;
}

/**
 * Stage3 (kouku / support air / base air)
 * NOTE: for combined battles may see "*_combined".
 */

export interface ApiStage3Raw {
  api_frai_flag?: ApiFlagArray | null;
  api_fbak_flag?: ApiFlagArray | null;
  api_fcl_flag?: ApiFlagArray | null;
  api_fdam?: ApiHpArray | null;

  api_erai_flag?: ApiFlagArray;
  api_ebak_flag?: ApiFlagArray;
  api_ecl_flag?: ApiFlagArray;
  api_edam?: ApiHpArray;
}
export interface ApiKoukuRaw {
  api_plane_from: Array<number[] | null> | null;
  api_stage1: ApiStage1Raw;
  api_stage2: ApiStage2Raw | null;
  api_stage3: ApiStage3Raw | null;

  /** combined battles may include extra stage3 for escort side */
  api_stage3_combined?: ApiStage3Raw | null;
  api_stage3_combined2?: ApiStage3Raw | null;
}

/** Land base airstrike segment */
export interface ApiSquadronPlaneRaw {
  api_mst_id: number;
  api_count: number;
}

export interface ApiAirBaseAttackRaw {
  api_base_id: number;
  api_plane_from: Array<number[] | null> | null;
  api_squadron_plane: ApiSquadronPlaneRaw[];

  api_stage_flag: number[];
  api_stage1: ApiStage1Raw;
  api_stage2: ApiStage2Raw | null;
  api_stage3: ApiStage3Raw | null;

  /** for combined battle */
  api_stage3_combined?: ApiStage3Raw | null;
  api_stage3_combined2?: ApiStage3Raw | null;
}

/** ---------- Support  ---------- */

export interface ApiSupportHouraiRaw {
  api_deck_id: number;
  api_ship_id: number[];
  api_undressing_flag: number[];

  /** damage aligned to enemy slots (often length 7 w/ dummy) */
  api_damage: ApiHpArray;
  api_cl_list: number[][]; // crit flags, nested
}

export interface ApiSupportAirRaw {
  api_deck_id: number;
  api_ship_id: number[];
  api_undressing_flag?: number[];

  api_stage_flag: number[];
  api_plane_from: Array<number[] | null> | null;
  api_stage1: ApiStage1Raw;
  api_stage2: ApiStage2Raw | null;
  api_stage3: ApiStage3Raw | null;

  api_stage3_combined?: ApiStage3Raw | null;
  api_stage3_combined2?: ApiStage3Raw | null;
}

export interface ApiSupportInfoRaw {
  api_support_hourai?: ApiSupportHouraiRaw;
  api_support_airatack?: ApiSupportAirRaw;
}

export interface ApiSupportFrameRaw {
  api_support_flag?: number;
  api_support_info?: ApiSupportInfoRaw | null;
}

/** ---------- Opening ASW / Shelling (hougeki) ---------- */
export interface ApiHougekiRaw {
  api_at_eflag: number[]; // 0 friend, 1 enemy
  api_at_list: number[];  // attacker index (1-based; combined can be 1..12)
  api_at_type?: number[]; // attack type codes
  api_df_list: number[][]; // defender list per attack (1-based)
  api_damage: number[][];  // damage list aligned with df_list
  api_cl_list?: number[][]; // crit list aligned with df_list
  api_si_list?: any; // equipment ids etc (varies)
}

export interface ApiHougekiFrameRaw {
  api_hourai_flag?: number[]; // flags for hougeki/raigeki presence

  api_opening_taisen_flag?: number;
  api_opening_taisen?: ApiHougekiRaw | null;

  api_hougeki1?: ApiHougekiRaw | null;
  api_hougeki2?: ApiHougekiRaw | null;
  api_hougeki3?: ApiHougekiRaw | null;
}

/** ---------- Opening torpedo / Torpedo (raigeki) ---------- */
/**
 * Torpedo-like structure used by opening_atack and raigeki in many responses.
 * The "y" arrays are used by combined/escort side in many cases.
 */
export interface ApiTorpedoRaw {
  api_frai: ApiNumArray;
  api_fcl: ApiNumArray;
  api_fdam: ApiHpArray;

  api_fydam?: ApiHpArray; // friend escort damage (often length 7 dummy)

  api_erai: ApiNumArray;
  api_ecl: ApiNumArray;
  api_edam: ApiHpArray;

  api_eydam?: ApiHpArray; // enemy escort damage (often length 7 dummy)
}
export interface ApiTorpedoFrameRaw {
  api_opening_flag?: number;
  api_opening_atack?: ApiTorpedoRaw | null;

  api_opening_flag2?: number;
  api_opening_atack2?: ApiTorpedoRaw | null;

  api_raigeki?: ApiTorpedoRaw | null;
}

/** ---------- Misc battle meta ---------- */
export interface ApiBattleMetaRaw {
  api_midnight_flag?: number; // 0/1 (whether night battle is possible/occurs)
  api_search?: number[];      // [friendSearch, enemySearch]
  api_stage_flag?: number[];  // [kouku, support, ...] varies

  api_smoke_type?: number;
  api_balloon_cell?: number;
  api_atoll_cell?: number;
}

/** ---------- Day battle payload (most) ---------- */
export interface ApiDayBattleDataRaw
extends ApiBasicBattleFrameRaw,
ApiSupportFrameRaw,
ApiHougekiFrameRaw,
ApiTorpedoFrameRaw,
ApiBattleMetaRaw {
  api_kouku?: ApiKoukuRaw | null;
  api_kouku2?: ApiKoukuRaw | null;

  api_air_base_attack?: ApiAirBaseAttackRaw[]; // may be absent

  api_opening_taisen_flag?: number;
  api_opening_taisen?: ApiHougekiRaw | null;

  /** some endpoints include these flags but set to 0/null */
  api_opening_flag?: number;
  api_opening_atack?: ApiTorpedoRaw | null;

  /** additional special keys for some "night_to_day" style endpoints */
  api_n_hougeki1?: ApiHougekiRaw | null;
  api_n_hougeki2?: ApiHougekiRaw | null;
  api_n_hougeki3?: ApiHougekiRaw | null;
  api_n_raigeki?: ApiTorpedoRaw | null;
}

/** ---------- Night battle payload (night) ---------- */
export interface ApiNightBattleDataRaw extends ApiBasicBattleFrameRaw, Partial<ApiFormationRaw> {
  api_flare_pos?: number[];   // [friend, enemy]
  api_touch_plane?: number[]; // [friend, enemy]
  api_hougeki: ApiHougekiRaw; // night shelling
}

/** ---------- Destruction battle (embedded in api_req_map/next) ---------- */
export interface ApiDestructionBattleRaw extends ApiBasicBattleFrameRaw, ApiSupportFrameRaw, ApiHougekiFrameRaw, ApiBattleMetaRaw {
  api_air_base_attack?: ApiAirBaseAttackRaw[];
  api_kouku?: ApiKoukuRaw | null;
  api_raigeki?: ApiTorpedoRaw | null;
}

/**
 * /kcsapi/api_req_map/next response may include api_destruction_battle (base air raid).
 * Treat it as a battle segment.
 */
export interface ApiReqMapNextDataRaw {
  api_destruction_battle?: ApiDestructionBattleRaw;
}


export type BattleApiPath =
  | 'api_req_practice/battle'
    | 'api_req_practice/midnight_battle'
    | 'api_req_battle_midnight/battle'
    | 'api_req_battle_midnight/sp_midnight'
    | 'api_req_sortie/battle'
    | 'api_req_sortie/airbattle'
    | 'api_req_sortie/battle_water'
    | 'api_req_combined_battle/ec_battle'
    | 'api_req_combined_battle/ec_midnight_battle'
    | 'api_req_combined_battle/battle'
    | 'api_req_combined_battle/midnight_battle'
    | 'api_req_combined_battle/sp_midnight'
    | 'api_req_combined_battle/airbattle'
    | 'api_req_combined_battle/ec_battle_water'
    | 'api_req_combined_battle/battle_water'
    | 'api_req_combined_battle/ld_airbattle'
    | 'api_req_combined_battle/each_battle'
    | 'api_req_combined_battle/each_battle_water'
    | 'api_req_combined_battle/ec_night_to_day'
    | 'api_req_combined_battle/ld_shooting'
    | 'api_destruction_battle'
    | 'api_req_map/next';

export type BattleApiDataAny = ApiDayBattleDataRaw | ApiNightBattleDataRaw | ApiDestructionBattleRaw | ApiReqMapNextDataRaw;
