/**
 * Transport Point (TP) Type Definitions and Constants
 *
 * TP is used in transport operations to reduce the transport gauge.
 * Total TP = Sum of ship type TP + Sum of equipment TP + Special bonuses
 *
 * Reference: https://wikiwiki.jp/kancolle/
 */

// ==================== Ship Type TP Values ====================

/**
 * Ship type IDs (stype)
 */
export enum ShipType {
  // Escort Ships
  CoastalDefenseShip = 1,  // 海防艦 (DE)

  // Destroyers
  Destroyer = 2,           // 駆逐艦 (DD)

  // Light Cruisers
  LightCruiser = 3,        // 軽巡洋艦 (CL)
  TorpedoCruiser = 4,      // 重雷装巡洋艦 (CLT)

  // Heavy Cruisers
  HeavyCruiser = 5,        // 重巡洋艦 (CA)
  AviationCruiser = 6,     // 航空巡洋艦 (CAV)

  // Carriers
  LightCarrier = 7,        // 軽空母 (CVL)
  StandardCarrier = 11,    // 正規空母 (CV)
  ArmoredCarrier = 18,     // 装甲空母 (CVB)

  // Battleships
  FastBattleship = 8,      // 高速戦艦 (FBB)
  Battleship = 9,          // 戦艦 (BB)
  AviationBattleship = 10, // 航空戦艦 (BBV)

  // Submarines
  Submarine = 13,          // 潜水艦 (SS)
  SubmarineCarrier = 14,   // 潜水空母 (SSV)

  // Auxiliary Ships
  SeaplaneTender = 16,     // 水上機母艦 (AV)
  AmphibiousAssaultShip = 17, // 揚陸艦 (LHA)
  RepairShip = 19,         // 工作艦 (AR)
  SubmarineTender = 20,    // 潜水母艦 (AS)
  TrainingCruiser = 21,    // 練習巡洋艦 (CT)
  FleetOiler = 22,         // 補給艦 (AO)
}

/**
 * TP values by ship type (S Victory)
 * Ships not listed here have 0 TP
 */
export const SHIP_TYPE_TP: Map<number, number> = new Map([
  [ShipType.Destroyer, 5],            // DD: 5
  [ShipType.LightCruiser, 2],         // CL: 2
  [ShipType.AviationCruiser, 4],      // CAV: 4
  [ShipType.AviationBattleship, 7],   // BBV: 7
  [ShipType.SeaplaneTender, 9],       // AV: 9
  [ShipType.AmphibiousAssaultShip, 12], // LHA: 12
  [ShipType.SubmarineTender, 6],      // AS: 6
  [ShipType.TrainingCruiser, 6],      // CT: 6
  [ShipType.FleetOiler, 15],          // AO: 15

  // Ships with 0 TP (listed for reference)
  // [ShipType.CoastalDefenseShip, 0],
  // [ShipType.TorpedoCruiser, 0],
  // [ShipType.HeavyCruiser, 0],
  // [ShipType.LightCarrier, 0],
  // [ShipType.StandardCarrier, 0],
  // [ShipType.ArmoredCarrier, 0],
  // [ShipType.FastBattleship, 0],
  // [ShipType.Battleship, 0],
  // [ShipType.Submarine, 0],
  // [ShipType.SubmarineCarrier, 0],
  // [ShipType.RepairShip, 0],
]);

/**
 * Get TP value for a ship type
 */
export function getShipTypeTP(stype: number): number {
  return SHIP_TYPE_TP.get(stype) ?? 0;
}

// ==================== Equipment TP Values ====================

/**
 * Equipment master IDs for transport equipment
 */
export enum TransportEquipId {
  // Drum Can
  DrumCanister = 75,                    // ドラム缶(輸送用)

  // Daihatsu Landing Craft series
  Daihatsu = 68,                        // 大発動艇
  DaihatsuType89Tank = 166,             // 大発動艇(八九式中戦車＆陸戦隊)
  TokuDaihatsu = 193,                   // 特大発動艇
  TokuDaihatsuTank11 = 230,             // 特大発動艇+戦車第11連隊
  ArmedDaihatsu = 409,                  // 武装大発
  DaihatsuPanzerII = 436,               // 大発動艇(II号戦車/北アフリカ仕様)
  M4A1DD = 355,                         // M4A1 DD
  TokuDaihatsuChiha = 494,              // 特大発動艇+チハ
  TokuDaihatsuChihaKai = 495,           // 特大発動艇+チハ改
  DaihatsuHoniI = 449,                  // 大発動艇(一式砲戦車搭載)

  // Special Landing Craft
  Type2Amphibious = 167,                // 特二式内火艇

  // Combat Rations
  CombatRation = 145,                   // 戦闘糧食
  CombatRationSpecial = 241,            // 戦闘糧食(特別なおにぎり)
  SanmaCan = 150,                       // 秋刀魚の缶詰

  // Landing Craft (Amphibious Tank)
  ArmoredBoat = 408,                    // 装甲艇(AB艇)
  ArmedDaihatsuKai = 482,               // 武装大発(Panzer II搭載型)
}

/**
 * TP values by equipment master ID (S Victory)
 * Only transport-related equipment listed
 */
export const EQUIPMENT_TP: Map<number, number> = new Map([
  // Drum Can: 5 TP
  [TransportEquipId.DrumCanister, 5],

  // Daihatsu series: 8 TP
  [TransportEquipId.Daihatsu, 8],
  [TransportEquipId.DaihatsuType89Tank, 8],
  [TransportEquipId.TokuDaihatsu, 8],
  [TransportEquipId.TokuDaihatsuTank11, 8],
  [TransportEquipId.ArmedDaihatsu, 8],
  [TransportEquipId.DaihatsuPanzerII, 8],
  [TransportEquipId.M4A1DD, 8],
  [TransportEquipId.TokuDaihatsuChiha, 8],
  [TransportEquipId.TokuDaihatsuChihaKai, 8],
  [TransportEquipId.DaihatsuHoniI, 8],
  [TransportEquipId.ArmedDaihatsuKai, 8],

  // Type 2 Amphibious Tank: 2 TP
  [TransportEquipId.Type2Amphibious, 2],

  // Armored Boat: 2 TP
  [TransportEquipId.ArmoredBoat, 2],

  // Combat Rations: 1 TP (consumed randomly after 3rd battle)
  [TransportEquipId.CombatRation, 1],
  [TransportEquipId.CombatRationSpecial, 1],
  [TransportEquipId.SanmaCan, 1],
]);

/**
 * Get TP value for an equipment
 */
export function getEquipmentTP(masterId: number): number {
  return EQUIPMENT_TP.get(masterId) ?? 0;
}

/**
 * Check if equipment is a transport equipment
 */
export function isTransportEquipment(masterId: number): boolean {
  return EQUIPMENT_TP.has(masterId);
}

// ==================== Special Ship Bonuses ====================

/**
 * Ship master IDs with special TP bonuses
 */
export enum SpecialTPShipId {
  // Kinu Kai Ni: +8 TP (equivalent to one Daihatsu)
  KinuKaiNi = 487,

  // Tatsuta Kai Ni: +8 TP (unconfirmed, but likely same as Kinu)
  // TatsutaKaiNi = 478,
}

/**
 * Special TP bonuses by ship master ID
 */
export const SPECIAL_SHIP_TP: Map<number, number> = new Map([
  [SpecialTPShipId.KinuKaiNi, 8],  // Kinu Kai Ni: +8 TP
  // [SpecialTPShipId.TatsutaKaiNi, 8], // Tatsuta Kai Ni: unconfirmed
]);

/**
 * Get special TP bonus for a ship
 */
export function getSpecialShipTP(masterId: number): number {
  return SPECIAL_SHIP_TP.get(masterId) ?? 0;
}

// ==================== Victory Multipliers ====================

/**
 * Victory rank
 */
export enum VictoryRank {
  S = 'S',
  A = 'A',
  B = 'B',  // Transport fails below A
  C = 'C',
  D = 'D',
  E = 'E',
}

/**
 * TP multipliers by victory rank
 */
export const VICTORY_MULTIPLIERS: Record<VictoryRank, number> = {
  [VictoryRank.S]: 1.0,
  [VictoryRank.A]: 0.7,
  [VictoryRank.B]: 0,  // Transport fails
  [VictoryRank.C]: 0,
  [VictoryRank.D]: 0,
  [VictoryRank.E]: 0,
};

/**
 * Get TP multiplier for a victory rank
 */
export function getVictoryMultiplier(rank: VictoryRank): number {
  return VICTORY_MULTIPLIERS[rank];
}

// ==================== Fleet Types ====================

/**
 * Fleet formation types for transport operations
 */
export enum FleetType {
  /** Single fleet (通常艦隊) */
  Single = 1,
  /** Combined Fleet - Carrier Task Force (機動部隊) */
  CarrierTaskForce = 2,
  /** Combined Fleet - Surface Task Force (水上部隊) */
  SurfaceTaskForce = 3,
  /** Combined Fleet - Transport Escort (輸送護衛部隊) */
  TransportEscort = 4,
}

/**
 * Check if fleet type is a combined fleet
 */
export function isCombinedFleet(fleetType: FleetType): boolean {
  return fleetType !== FleetType.Single;
}

// ==================== Combat Ration Warning ====================

/**
 * Equipment IDs that may be consumed before landing point
 * (Combat rations are randomly consumed after 3rd battle)
 */
export const CONSUMABLE_TP_EQUIPMENT: Set<number> = new Set([
  TransportEquipId.CombatRation,
  TransportEquipId.CombatRationSpecial,
  TransportEquipId.SanmaCan,
]);

/**
 * Check if equipment may be consumed before landing point
 */
export function isConsumableTPEquipment(masterId: number): boolean {
  return CONSUMABLE_TP_EQUIPMENT.has(masterId);
}
