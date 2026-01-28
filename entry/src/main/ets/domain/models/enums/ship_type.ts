/**
 * 舰船类型枚举 (api_stype)
 * 基于 api_mst_stype 定义
 */
export enum ShipType {
  /** 海防艦 - Escort */
  DE = 1,
  /** 駆逐艦 - Destroyer */
  DD = 2,
  /** 軽巡洋艦 - Light Cruiser */
  CL = 3,
  /** 重雷装巡洋艦 - Torpedo Cruiser */
  CLT = 4,
  /** 重巡洋艦 - Heavy Cruiser */
  CA = 5,
  /** 航空巡洋艦 - Aircraft Cruiser */
  CAV = 6,
  /** 軽空母 - Light Aircraft Carrier */
  CVL = 7,
  /** 巡洋戦艦 (高速戦艦) - Fast Battleship */
  FBB = 8,
  /** 戦艦 - Battleship */
  BB = 9,
  /** 航空戦艦 - Aviation Battleship */
  BBV = 10,
  /** 正規空母 - Aircraft Carrier */
  CV = 11,
  /** 超弩級戦艦 - Super Dreadnoughts */
  XBB = 12,
  /** 潜水艦 - Submarine */
  SS = 13,
  /** 潜水空母 - Aircraft Carrying Submarine */
  SSV = 14,
  /** 補給艦(敵) - Enemy Supply Ship */
  AO_ENEMY = 15,
  /** 水上機母艦 - Seaplane Carrier */
  AV = 16,
  /** 揚陸艦 - Amphibious Assault Ship */
  LHA = 17,
  /** 装甲空母 - Armored Carrier */
  CVB = 18,
  /** 工作艦 - Repair Ship */
  AR = 19,
  /** 潜水母艦 - Submarine Tender */
  AS = 20,
  /** 練習巡洋艦 - Training Cruiser */
  CT = 21,
  /** 補給艦 - Fleet Oiler */
  AO = 22,
}

/** 舰船类型显示名称 (日文) */
export const ShipTypeNameJP: Record<ShipType, string> = {
  [ShipType.DE]: '海防艦',
  [ShipType.DD]: '駆逐艦',
  [ShipType.CL]: '軽巡洋艦',
  [ShipType.CLT]: '重雷装巡洋艦',
  [ShipType.CA]: '重巡洋艦',
  [ShipType.CAV]: '航空巡洋艦',
  [ShipType.CVL]: '軽空母',
  [ShipType.FBB]: '巡洋戦艦',
  [ShipType.BB]: '戦艦',
  [ShipType.BBV]: '航空戦艦',
  [ShipType.CV]: '正規空母',
  [ShipType.XBB]: '超弩級戦艦',
  [ShipType.SS]: '潜水艦',
  [ShipType.SSV]: '潜水空母',
  [ShipType.AO_ENEMY]: '補給艦',
  [ShipType.AV]: '水上機母艦',
  [ShipType.LHA]: '揚陸艦',
  [ShipType.CVB]: '装甲空母',
  [ShipType.AR]: '工作艦',
  [ShipType.AS]: '潜水母艦',
  [ShipType.CT]: '練習巡洋艦',
  [ShipType.AO]: '補給艦',
};

/** 舰船类型显示名称 (英文) */
export const ShipTypeNameEN: Record<ShipType, string> = {
  [ShipType.DE]: 'Escort',
  [ShipType.DD]: 'Destroyer',
  [ShipType.CL]: 'Light Cruiser',
  [ShipType.CLT]: 'Torpedo Cruiser',
  [ShipType.CA]: 'Heavy Cruiser',
  [ShipType.CAV]: 'Aircraft Cruiser',
  [ShipType.CVL]: 'Light Carrier',
  [ShipType.FBB]: 'Fast Battleship',
  [ShipType.BB]: 'Battleship',
  [ShipType.BBV]: 'Aviation Battleship',
  [ShipType.CV]: 'Aircraft Carrier',
  [ShipType.XBB]: 'Super Dreadnoughts',
  [ShipType.SS]: 'Submarine',
  [ShipType.SSV]: 'Submarine Carrier',
  [ShipType.AO_ENEMY]: 'Supply Ship',
  [ShipType.AV]: 'Seaplane Tender',
  [ShipType.LHA]: 'Amphibious Ship',
  [ShipType.CVB]: 'Armored Carrier',
  [ShipType.AR]: 'Repair Ship',
  [ShipType.AS]: 'Submarine Tender',
  [ShipType.CT]: 'Training Cruiser',
  [ShipType.AO]: 'Fleet Oiler',
};

/** 舰船类型简称 */
export const ShipTypeShort: Record<ShipType, string> = {
  [ShipType.DE]: 'DE',
  [ShipType.DD]: 'DD',
  [ShipType.CL]: 'CL',
  [ShipType.CLT]: 'CLT',
  [ShipType.CA]: 'CA',
  [ShipType.CAV]: 'CAV',
  [ShipType.CVL]: 'CVL',
  [ShipType.FBB]: 'FBB',
  [ShipType.BB]: 'BB',
  [ShipType.BBV]: 'BBV',
  [ShipType.CV]: 'CV',
  [ShipType.XBB]: 'XBB',
  [ShipType.SS]: 'SS',
  [ShipType.SSV]: 'SSV',
  [ShipType.AO_ENEMY]: 'AO',
  [ShipType.AV]: 'AV',
  [ShipType.LHA]: 'LHA',
  [ShipType.CVB]: 'CVB',
  [ShipType.AR]: 'AR',
  [ShipType.AS]: 'AS',
  [ShipType.CT]: 'CT',
  [ShipType.AO]: 'AO',
};

/** 是否为航母系（可搭载舰载机） */
export function isCarrierType(stype: ShipType): boolean {
  return stype === ShipType.CVL
    || stype === ShipType.CV
    || stype === ShipType.CVB;
}

/** 是否为战舰系 */
export function isBattleshipType(stype: ShipType): boolean {
  return stype === ShipType.FBB
    || stype === ShipType.BB
    || stype === ShipType.BBV
    || stype === ShipType.XBB;
}

/** 是否为巡洋舰系 */
export function isCruiserType(stype: ShipType): boolean {
  return stype === ShipType.CL
    || stype === ShipType.CLT
    || stype === ShipType.CA
    || stype === ShipType.CAV
    || stype === ShipType.CT;
}

/** 是否为潜水艇系 */
export function isSubmarineType(stype: ShipType): boolean {
  return stype === ShipType.SS
    || stype === ShipType.SSV;
}

/** 是否可参与夜战 */
export function canNightBattle(stype: ShipType): boolean {
  // 航母系在一般情况下不参与夜战（除非有特殊装备）
  return !isCarrierType(stype);
}

/** 是否可进行先制反潜 */
export function canOpeningASW(stype: ShipType): boolean {
  // 海防舰、轻空母（护卫空母）等可进行先制反潜
  return stype === ShipType.DE
    || stype === ShipType.CVL
    || stype === ShipType.AV
    || stype === ShipType.CT
    || stype === ShipType.CL
    || stype === ShipType.DD;
}
