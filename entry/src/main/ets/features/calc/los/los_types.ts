/**
 * Line of Sight (LoS) Type Definitions and Constants
 *
 * Based on Formula 33 (判定式33) for map routing calculations.
 *
 * Formula:
 *   LoS Score = Σ√(ship base LoS)
 *             + branch coefficient × Σ(equip coefficient × (equip LoS + improvement coefficient × √★))
 *             - ceil(HQ penalty coefficient × HQ level)
 *             + 2 × (6 - ship count)
 *
 * Reference: https://wikiwiki.jp/kancolle/ルート分岐
 */

// ==================== Equipment Categories ====================

/**
 * Equipment category for LoS calculation
 * Each category has different coefficients
 */
export enum LoSEquipCategory {
  /** 艦上戦闘機 - Carrier-based Fighter */
  CarrierFighter = 'carrier_fighter',
  /** 艦上爆撃機 - Carrier-based Dive Bomber */
  CarrierDiveBomber = 'carrier_dive_bomber',
  /** 艦上攻撃機 - Carrier-based Torpedo Bomber */
  CarrierTorpedoBomber = 'carrier_torpedo_bomber',
  /** 艦上偵察機 - Carrier-based Recon */
  CarrierRecon = 'carrier_recon',
  /** 水上偵察機 - Seaplane Recon */
  SeaplaneRecon = 'seaplane_recon',
  /** 水上爆撃機 - Seaplane Bomber */
  SeaplaneBomber = 'seaplane_bomber',
  /** 水上戦闘機 - Seaplane Fighter */
  SeaplaneFighter = 'seaplane_fighter',
  /** 小型電探 - Small Radar */
  SmallRadar = 'small_radar',
  /** 大型電探 - Large Radar */
  LargeRadar = 'large_radar',
  /** 探照灯 - Searchlight */
  Searchlight = 'searchlight',
  /** 大型探照灯 - Large Searchlight */
  LargeSearchlight = 'large_searchlight',
  /** 対潜哨戒機 - ASW Patrol Aircraft */
  ASWPatrol = 'asw_patrol',
  /** 回転翼機 - Autogyro */
  Autogyro = 'autogyro',
  /** 大型飛行艇 - Large Flying Boat */
  LargeFlyingBoat = 'large_flying_boat',
  /** 艦隊司令部施設 - Fleet Command Facility */
  CommandFacility = 'command_facility',
  /** 航空要員 - Aviation Personnel */
  AviationPersonnel = 'aviation_personnel',
  /** 水上艦要員 - Surface Ship Personnel (Lookouts) */
  SurfacePersonnel = 'surface_personnel',
  /** ソナー - Sonar */
  Sonar = 'sonar',
  /** 大型ソナー - Large Sonar */
  LargeSonar = 'large_sonar',
  /** 潜水艦装備 - Submarine Equipment */
  SubmarineEquip = 'submarine_equip',
  /** 魚雷 - Torpedo */
  Torpedo = 'torpedo',
  /** 小口径主砲 - Small Main Gun */
  SmallMainGun = 'small_main_gun',
  /** 夜間戦闘機 - Night Fighter */
  NightFighter = 'night_fighter',
  /** 夜間攻撃機 - Night Torpedo Bomber */
  NightTorpedoBomber = 'night_torpedo_bomber',
  /** 噴式戦闘爆撃機 - Jet Fighter-Bomber */
  JetFighterBomber = 'jet_fighter_bomber',
  /** その他 - Other equipment with LoS */
  Other = 'other',
}

// ==================== Equipment Type Coefficients ====================

/**
 * Equipment coefficient for LoS calculation (装備係数)
 * Applied to equipment LoS value
 */
export const LOS_EQUIP_COEFFICIENT: Record<LoSEquipCategory, number> = {
  // Coefficient 0.6
  [LoSEquipCategory.CarrierFighter]: 0.6,
  [LoSEquipCategory.CarrierDiveBomber]: 0.6,
  [LoSEquipCategory.SmallRadar]: 0.6,
  [LoSEquipCategory.LargeRadar]: 0.6,
  [LoSEquipCategory.Searchlight]: 0.6,
  [LoSEquipCategory.LargeSearchlight]: 0.6,
  [LoSEquipCategory.ASWPatrol]: 0.6,
  [LoSEquipCategory.Autogyro]: 0.6,
  [LoSEquipCategory.LargeFlyingBoat]: 0.6,
  [LoSEquipCategory.CommandFacility]: 0.6,
  [LoSEquipCategory.AviationPersonnel]: 0.6,
  [LoSEquipCategory.SurfacePersonnel]: 0.6,
  [LoSEquipCategory.Sonar]: 0.6,
  [LoSEquipCategory.LargeSonar]: 0.6,
  [LoSEquipCategory.SubmarineEquip]: 0.6,
  [LoSEquipCategory.Torpedo]: 0.6,
  [LoSEquipCategory.SmallMainGun]: 0.6,
  [LoSEquipCategory.SeaplaneFighter]: 0.6,
  [LoSEquipCategory.NightFighter]: 0.6,
  [LoSEquipCategory.JetFighterBomber]: 0.6,
  [LoSEquipCategory.Other]: 0.6,

  // Coefficient 0.8
  [LoSEquipCategory.CarrierTorpedoBomber]: 0.8,
  [LoSEquipCategory.NightTorpedoBomber]: 0.8,

  // Coefficient 1.0
  [LoSEquipCategory.CarrierRecon]: 1.0,

  // Coefficient 1.1
  [LoSEquipCategory.SeaplaneBomber]: 1.1,

  // Coefficient 1.2
  [LoSEquipCategory.SeaplaneRecon]: 1.2,
};

// ==================== Improvement Coefficients ====================

/**
 * Improvement coefficient for LoS calculation (改修係数)
 * Applied as: improvement coefficient × √(improvement level)
 * 0 means improvement has no effect on LoS
 */
export const LOS_IMPROVEMENT_COEFFICIENT: Record<LoSEquipCategory, number> = {
  // No improvement effect (0.0)
  [LoSEquipCategory.CarrierFighter]: 0,
  [LoSEquipCategory.CarrierDiveBomber]: 0,
  [LoSEquipCategory.Searchlight]: 0,
  [LoSEquipCategory.LargeSearchlight]: 0,
  [LoSEquipCategory.SeaplaneFighter]: 0,
  [LoSEquipCategory.SubmarineEquip]: 0,
  [LoSEquipCategory.Autogyro]: 0,
  [LoSEquipCategory.ASWPatrol]: 0,
  [LoSEquipCategory.LargeFlyingBoat]: 0,
  [LoSEquipCategory.CommandFacility]: 0,
  [LoSEquipCategory.AviationPersonnel]: 0,
  [LoSEquipCategory.SurfacePersonnel]: 0,
  [LoSEquipCategory.Sonar]: 0,
  [LoSEquipCategory.LargeSonar]: 0,
  [LoSEquipCategory.Torpedo]: 0,
  [LoSEquipCategory.SmallMainGun]: 0,
  [LoSEquipCategory.NightFighter]: 0,
  [LoSEquipCategory.JetFighterBomber]: 0,
  [LoSEquipCategory.CarrierTorpedoBomber]: 0,
  [LoSEquipCategory.NightTorpedoBomber]: 0,
  [LoSEquipCategory.Other]: 0,

  // Seaplane Bomber: 1.15
  [LoSEquipCategory.SeaplaneBomber]: 1.15,

  // Carrier Recon, Seaplane Recon: 1.20
  [LoSEquipCategory.CarrierRecon]: 1.2,
  [LoSEquipCategory.SeaplaneRecon]: 1.2,

  // Small Radar: 1.25
  [LoSEquipCategory.SmallRadar]: 1.25,

  // Large Radar: 1.40
  [LoSEquipCategory.LargeRadar]: 1.4,
};

// ==================== Equipment Type Mapping ====================

/**
 * Map equipment type ID (api_type[2]) to LoS category
 */
export const EQUIP_TYPE_TO_LOS_CATEGORY: Map<number, LoSEquipCategory> = new Map([
  // Fighters
  [6, LoSEquipCategory.CarrierFighter],     // 艦上戦闘機
  [45, LoSEquipCategory.SeaplaneFighter],   // 水上戦闘機
  [56, LoSEquipCategory.JetFighterBomber],  // 噴式戦闘爆撃機

  // Bombers
  [7, LoSEquipCategory.CarrierDiveBomber],  // 艦上爆撃機
  [8, LoSEquipCategory.CarrierTorpedoBomber], // 艦上攻撃機
  [11, LoSEquipCategory.SeaplaneBomber],    // 水上爆撃機

  // Recon
  [9, LoSEquipCategory.CarrierRecon],       // 艦上偵察機
  [10, LoSEquipCategory.SeaplaneRecon],     // 水上偵察機
  [94, LoSEquipCategory.CarrierRecon],      // 艦上偵察機(II)

  // Radar
  [12, LoSEquipCategory.SmallRadar],        // 小型電探
  [13, LoSEquipCategory.LargeRadar],        // 大型電探
  [93, LoSEquipCategory.LargeRadar],        // 大型電探(II)

  // Searchlights
  [29, LoSEquipCategory.Searchlight],       // 探照灯
  [42, LoSEquipCategory.LargeSearchlight],  // 大型探照灯

  // ASW Aircraft
  [25, LoSEquipCategory.Autogyro],          // オートジャイロ
  [26, LoSEquipCategory.ASWPatrol],         // 対潜哨戒機

  // Flying Boat
  [33, LoSEquipCategory.LargeFlyingBoat],   // 大型飛行艇

  // Sonar
  [14, LoSEquipCategory.Sonar],             // ソナー
  [40, LoSEquipCategory.LargeSonar],        // 大型ソナー

  // Personnel
  [34, LoSEquipCategory.CommandFacility],   // 司令部施設
  [35, LoSEquipCategory.AviationPersonnel], // 航空要員
  [39, LoSEquipCategory.SurfacePersonnel],  // 水上艦要員

  // Submarine
  [22, LoSEquipCategory.SubmarineEquip],    // 特殊潜航艇
  [51, LoSEquipCategory.SubmarineEquip],    // 潜航艇電探

  // Torpedo
  [5, LoSEquipCategory.Torpedo],            // 魚雷
  [32, LoSEquipCategory.Torpedo],           // 潜水艦魚雷

  // Main Gun
  [1, LoSEquipCategory.SmallMainGun],       // 小口径主砲

  // Night Aircraft
  [45, LoSEquipCategory.NightFighter],      // 夜間戦闘機 (shares type with seaplane fighter)
  [46, LoSEquipCategory.NightTorpedoBomber], // 夜間攻撃機
]);

/**
 * Night aircraft equipment IDs (need special handling)
 * These share type IDs with other categories
 */
export const NIGHT_FIGHTER_IDS: Set<number> = new Set([
  153, // F6F-3N
  154, // F6F-5N
  // Add more as needed
]);

export const NIGHT_TORPEDO_BOMBER_IDS: Set<number> = new Set([
  254, // TBM-3D
  255, // TBM-3W+3S
  // Add more as needed
]);

// ==================== HQ Level Penalty ====================

/**
 * HQ level penalty coefficient
 * Most maps use 0.4, some specific maps use 0.35
 */
export enum HQLevelCoefficient {
  /** Standard coefficient for most maps */
  Standard = 0.4,
  /** Reduced coefficient for specific maps (1-6M, 3-5G, 5-2F, 6-2I, 6-3H) */
  Reduced = 0.35,
}

/**
 * Maps using reduced HQ level coefficient (0.35)
 * Format: "mapId-node" e.g., "1-6-M", "3-5-G"
 */
export const REDUCED_HQ_COEFFICIENT_NODES: Set<string> = new Set([
  '1-6-M',
  '3-5-G',
  '5-2-F',
  '6-2-I',
  '6-3-H',
]);

/**
 * Check if a node uses reduced HQ coefficient
 */
export function usesReducedHQCoefficient(mapId: string, node: string): boolean {
  return REDUCED_HQ_COEFFICIENT_NODES.has(`${mapId}-${node}`);
}

// ==================== Branch Point Coefficients ====================

/**
 * Branch point coefficient (分岐点係数)
 * Multiplies the equipment LoS contribution
 */
export interface BranchPointInfo {
  /** Map ID (e.g., "2-5", "6-1") */
  mapId: string;
  /** Node name (e.g., "I", "F") */
  node: string;
  /** Branch point coefficient */
  coefficient: number;
  /** Required LoS score for favorable route */
  requiredLoS?: number;
  /** HQ level coefficient for this node */
  hqCoefficient: HQLevelCoefficient;
  /** Description */
  description?: string;
}

/**
 * Known branch point coefficients
 * This is not exhaustive - event maps have their own coefficients
 */
export const BRANCH_POINT_COEFFICIENTS: BranchPointInfo[] = [
  // World 1
  { mapId: '1-6', node: 'M', coefficient: 4, hqCoefficient: HQLevelCoefficient.Reduced },

  // World 2
  { mapId: '2-5', node: 'I', coefficient: 1, requiredLoS: 34, hqCoefficient: HQLevelCoefficient.Standard },

  // World 3
  { mapId: '3-5', node: 'G', coefficient: 4, hqCoefficient: HQLevelCoefficient.Reduced },

  // World 5
  { mapId: '5-2', node: 'F', coefficient: 3, hqCoefficient: HQLevelCoefficient.Reduced },
  { mapId: '5-5', node: 'I', coefficient: 4, hqCoefficient: HQLevelCoefficient.Standard },

  // World 6
  { mapId: '6-1', node: 'F', coefficient: 4, requiredLoS: 36, hqCoefficient: HQLevelCoefficient.Standard },
  { mapId: '6-2', node: 'I', coefficient: 4, hqCoefficient: HQLevelCoefficient.Reduced },
  { mapId: '6-3', node: 'H', coefficient: 4, hqCoefficient: HQLevelCoefficient.Reduced },
  { mapId: '6-5', node: 'G', coefficient: 3, requiredLoS: 50, hqCoefficient: HQLevelCoefficient.Standard },

  // World 7
  { mapId: '7-2', node: 'I', coefficient: 4, hqCoefficient: HQLevelCoefficient.Standard },
  { mapId: '7-3', node: 'E', coefficient: 4, hqCoefficient: HQLevelCoefficient.Standard },
];

/**
 * Get branch point info for a specific map and node
 */
export function getBranchPointInfo(mapId: string, node: string): BranchPointInfo | undefined {
  return BRANCH_POINT_COEFFICIENTS.find(bp => bp.mapId === mapId && bp.node === node);
}

/**
 * Get default branch point coefficient (1 if unknown)
 */
export function getBranchCoefficient(mapId: string, node: string): number {
  const info = getBranchPointInfo(mapId, node);
  return info?.coefficient ?? 1;
}

// ==================== Fleet Types ====================

/**
 * Fleet formation for LoS calculation
 */
export enum LoSFleetType {
  /** Single fleet (6 ships max) */
  Single = 'single',
  /** Combined fleet (12 ships, main + escort) */
  Combined = 'combined',
  /** Striking Force (7 ships) */
  StrikingForce = 'striking',
}

/**
 * Get standard ship count for fleet type
 */
export function getStandardShipCount(fleetType: LoSFleetType): number {
  switch (fleetType) {
    case LoSFleetType.Single:
      return 6;
    case LoSFleetType.Combined:
      return 12;
    case LoSFleetType.StrikingForce:
      return 7;
    default:
      return 6;
  }
}

// ==================== Common Default Values ====================

/** Default branch point coefficient */
export const DEFAULT_BRANCH_COEFFICIENT = 1;

/** Default HQ level for calculations */
export const DEFAULT_HQ_LEVEL = 120;

/** Fleet size adjustment base (for single fleet) */
export const FLEET_SIZE_ADJUSTMENT_BASE = 6;

/** Fleet size adjustment for striking force */
export const STRIKING_FORCE_SIZE_ADJUSTMENT_BASE = 7;
