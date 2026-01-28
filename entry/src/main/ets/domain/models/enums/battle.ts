/**
 * 战斗阵型枚举 (api_formation)
 */
export enum Formation {
  /** 単縦陣 - Line Ahead */
  LINE_AHEAD = 1,
  /** 複縦陣 - Double Line */
  DOUBLE_LINE = 2,
  /** 輪形陣 - Diamond */
  DIAMOND = 3,
  /** 梯形陣 - Echelon */
  ECHELON = 4,
  /** 単横陣 - Line Abreast */
  LINE_ABREAST = 5,
  /** 警戒陣 - Vanguard */
  VANGUARD = 6,

  // 联合舰队阵型
  /** 第一警戒航行序列 (対潜警戒) */
  COMBINED_ASW = 11,
  /** 第二警戒航行序列 (前方警戒) */
  COMBINED_FORWARD = 12,
  /** 第三警戒航行序列 (輪形陣) */
  COMBINED_DIAMOND = 13,
  /** 第四警戒航行序列 (戦闘隊形) */
  COMBINED_BATTLE = 14,
}

/** 阵型名称 (日文) */
export const FormationNameJP: Record<Formation, string> = {
  [Formation.LINE_AHEAD]: '単縦陣',
  [Formation.DOUBLE_LINE]: '複縦陣',
  [Formation.DIAMOND]: '輪形陣',
  [Formation.ECHELON]: '梯形陣',
  [Formation.LINE_ABREAST]: '単横陣',
  [Formation.VANGUARD]: '警戒陣',
  [Formation.COMBINED_ASW]: '第一警戒航行序列',
  [Formation.COMBINED_FORWARD]: '第二警戒航行序列',
  [Formation.COMBINED_DIAMOND]: '第三警戒航行序列',
  [Formation.COMBINED_BATTLE]: '第四警戒航行序列',
};

/**
 * 交战形态枚举 (api_formation[2])
 */
export enum Engagement {
  /** 同航戦 - Parallel */
  PARALLEL = 1,
  /** 反航戦 - Head-on */
  HEAD_ON = 2,
  /** T字有利 - Crossing (Advantage) */
  T_ADV = 3,
  /** T字不利 - Crossing (Disadvantage) */
  T_DIS = 4,
}

/** 交战形态名称 */
export const EngagementNameJP: Record<Engagement, string> = {
  [Engagement.PARALLEL]: '同航戦',
  [Engagement.HEAD_ON]: '反航戦',
  [Engagement.T_ADV]: 'T字有利',
  [Engagement.T_DIS]: 'T字不利',
};

/** 交战形态攻击力倍率 */
export const EngagementModifier: Record<Engagement, number> = {
  [Engagement.PARALLEL]: 1.0,
  [Engagement.HEAD_ON]: 0.8,
  [Engagement.T_ADV]: 1.2,
  [Engagement.T_DIS]: 0.6,
};

/**
 * 制空状态枚举 (api_kouku.api_stage1.api_disp_seiku)
 */
export enum AirState {
  /** 制空権確保 - Air Supremacy */
  SUPREMACY = 1,
  /** 航空優勢 - Air Superiority */
  SUPERIORITY = 2,
  /** 航空劣勢 - Air Denial */
  DENIAL = 3,
  /** 制空権喪失 - Air Incapability */
  INCAPABILITY = 4,
  /** 航空均衡 - Air Parity */
  PARITY = 0,
}

/** 制空状态名称 */
export const AirStateNameJP: Record<AirState, string> = {
  [AirState.SUPREMACY]: '制空権確保',
  [AirState.SUPERIORITY]: '航空優勢',
  [AirState.DENIAL]: '航空劣勢',
  [AirState.INCAPABILITY]: '制空権喪失',
  [AirState.PARITY]: '航空均衡',
};

/**
 * 战斗结果等级 (api_win_rank)
 */
export enum BattleRank {
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
}

/**
 * 昼战攻击类型 (api_hougeki.api_at_type)
 */
export enum DayAttackType {
  /** 通常攻撃 */
  NORMAL = 0,
  /** レーザー攻撃 (深海only) */
  LASER = 1,
  /** 連続射撃 (主主) */
  DOUBLE_ATTACK = 2,
  /** 主砲カットイン (主主副) */
  CUTIN_MAIN_SUB = 3,
  /** 主砲カットイン (主主主) */
  CUTIN_MAIN_MAIN = 4,
  /** 主砲カットイン (主主徹) */
  CUTIN_MAIN_AP = 5,
  /** 主砲カットイン (主徹電) */
  CUTIN_MAIN_AP_RADAR = 6,
  /** 空母カットイン (戦爆攻) */
  CUTIN_CVCI = 7,
  /** 空母カットイン (爆爆攻) */
  CUTIN_CVCI_BA = 8,
  /** 空母カットイン (爆攻攻) */
  CUTIN_CVCI_AA = 9,

  /** Nelson Touch */
  SPECIAL_NELSON = 100,
  /** 長門一斉射 */
  SPECIAL_NAGATO = 101,
  /** 長門一斉射(徹甲弾) */
  SPECIAL_NAGATO_AP = 102,
  /** Colorado特殊攻撃 */
  SPECIAL_COLORADO = 103,
  /** 僚艦夜戦突撃 */
  SPECIAL_KONGOU = 104,
  /** 大和改二特殊攻撃 (二番艦) */
  SPECIAL_YAMATO_2 = 105,
  /** 大和改二特殊攻撃 (三番艦) */
  SPECIAL_YAMATO_3 = 106,
}

/**
 * 夜战攻击类型 (api_sp_list / api_hougeki.api_at_type)
 */
export enum NightAttackType {
  /** 通常攻撃 */
  NORMAL = 0,
  /** 連続攻撃 */
  DOUBLE_ATTACK = 1,
  /** 主砲カットイン (主主) */
  CUTIN_MAIN_MAIN = 2,
  /** 魚雷カットイン (雷雷) */
  CUTIN_TORP_TORP = 3,
  /** 主砲カットイン (主副) */
  CUTIN_MAIN_SUB = 4,
  /** 主砲カットイン (主雷) */
  CUTIN_MAIN_TORP = 5,
  /** 空母夜間航空攻撃 */
  CARRIER_NIGHT = 6,
  /** 夜間触接 + 空母夜間航空攻撃 */
  CARRIER_NIGHT_CONTACT = 7,
  /** 駆逐カットイン (主魚電) */
  CUTIN_DD_MAIN_TORP_RADAR = 8,
  /** 駆逐カットイン (魚見電) */
  CUTIN_DD_TORP_LOOKOUT_RADAR = 9,
  /** 潜水艦カットイン (後期雷) */
  CUTIN_SUB_LATE_TORP = 10,
  /** 潜水艦カットイン (後期雷雷) */
  CUTIN_SUB_LATE_TORP_2 = 11,

  /** Nelson Touch */
  SPECIAL_NELSON = 100,
  /** 長門一斉射 */
  SPECIAL_NAGATO = 101,
  /** 長門一斉射(徹甲弾) */
  SPECIAL_NAGATO_AP = 102,
  /** Colorado特殊攻撃 */
  SPECIAL_COLORADO = 103,
  /** 僚艦夜戦突撃 */
  SPECIAL_KONGOU = 104,
  /** 大和改二特殊攻撃 (二番艦) */
  SPECIAL_YAMATO_2 = 105,
  /** 大和改二特殊攻撃 (三番艦) */
  SPECIAL_YAMATO_3 = 106,
}

/**
 * 联合舰队类型 (api_combined_flag)
 */
export enum CombinedFleetType {
  /** 非联合 */
  NONE = 0,
  /** 機動部隊 - Carrier Task Force */
  CTF = 1,
  /** 水上部隊 - Surface Task Force */
  STF = 2,
  /** 輸送部隊 - Transport Escort */
  TCF = 3,
}

/** 联合舰队类型名称 */
export const CombinedFleetTypeNameJP: Record<CombinedFleetType, string> = {
  [CombinedFleetType.NONE]: '通常艦隊',
  [CombinedFleetType.CTF]: '空母機動部隊',
  [CombinedFleetType.STF]: '水上打撃部隊',
  [CombinedFleetType.TCF]: '輸送護衛部隊',
};

/**
 * 点位事件类型 (api_event_id)
 */
export enum MapEventType {
  /** 初期位置 */
  START = 0,
  /** 無し - Nothing */
  NOTHING = 1,
  /** 資源獲得 */
  RESOURCE = 2,
  /** 渦潮 - Maelstrom */
  MAELSTROM = 3,
  /** 戦闘 - Combat */
  BATTLE = 4,
  /** ボス - Boss */
  BOSS = 5,
  /** 気のせいだった - Nothing (False Alarm) */
  FALSE_ALARM = 6,
  /** 航空戦 - Air Battle */
  AIR_BATTLE = 7,
  /** 護衛成功 - Escort Success */
  ESCORT_SUCCESS = 8,
  /** 揚陸地点 - Landing Point */
  LANDING = 9,
  /** 空襲戦 - Air Raid */
  AIR_RAID = 10,
  /** 長距離空襲戦 */
  LONG_AIR_RAID = 11,
  /** レーダー射撃 - Night Raid */
  NIGHT_RAID = 12,
  /** 泊地 - Anchorage */
  ANCHORAGE = 13,
  /** 能動分岐 - Active Route Selection */
  ROUTE_SELECT = 14,
}

/** 是否为战斗节点 */
export function isBattleEvent(eventId: MapEventType): boolean {
  return eventId === MapEventType.BATTLE
    || eventId === MapEventType.BOSS
    || eventId === MapEventType.AIR_BATTLE
    || eventId === MapEventType.AIR_RAID
    || eventId === MapEventType.LONG_AIR_RAID
    || eventId === MapEventType.NIGHT_RAID;
}
