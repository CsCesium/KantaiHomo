/**
 * Line of Sight (LoS) Module
 *
 * Provides LoS calculation using Formula 33 (判定式33) for map routing.
 *
 * Formula:
 *   LoS Score = Σ√(ship base LoS)
 *             + branch coefficient × Σ(equip coefficient × (equip LoS + improvement coefficient × √★))
 *             - ceil(HQ penalty coefficient × HQ level)
 *             + 2 × (6 - ship count)
 *
 * Main features:
 * - Ship base LoS calculation (sqrt of naked LoS)
 * - Equipment LoS calculation with type-specific coefficients
 * - Improvement bonus calculation
 * - Branch point coefficient support
 * - HQ level penalty calculation
 * - Fleet size adjustment
 * - Combined fleet support
 * - Map node-specific calculation
 */

// Type definitions and constants
export {
  // Equipment categories
  LoSEquipCategory,
  LOS_EQUIP_COEFFICIENT,
  LOS_IMPROVEMENT_COEFFICIENT,
  EQUIP_TYPE_TO_LOS_CATEGORY,
  NIGHT_FIGHTER_IDS,
  NIGHT_TORPEDO_BOMBER_IDS,

  // HQ level
  HQLevelCoefficient,
  REDUCED_HQ_COEFFICIENT_NODES,
  usesReducedHQCoefficient,

  // Branch points
  BranchPointInfo,
  BRANCH_POINT_COEFFICIENTS,
  getBranchPointInfo,
  getBranchCoefficient,

  // Fleet types
  LoSFleetType,
  getStandardShipCount,

  // Constants
  DEFAULT_BRANCH_COEFFICIENT,
  DEFAULT_HQ_LEVEL,
  FLEET_SIZE_ADJUSTMENT_BASE,
  STRIKING_FORCE_SIZE_ADJUSTMENT_BASE,
} from './los_types';

// Calculator functions
export {
  // Types
  LoSEquipInfo,
  ShipLoSResult,
  FleetLoSResult,
  LoSCalculationResult,
  LoSBreakdown,

  // Category detection
  getLoSCategory,
  getEquipCoefficient,
  getImprovementCoefficient,

  // Equipment calculation
  calcEquipLoSContribution,
  calcEquipLoSInfo,

  // Ship calculation
  calcShipLoS,

  // Fleet calculation
  calcFleetLoS,

  // Score calculation
  calcHQLevelPenalty,
  calcLoSScore,
  calcCombinedLoSScore,
  calcLoSForMapNode,

  // Utilities
  calcLoSForMultipleCoefficients,
  calcRequiredEquipLoS,
  formatLoSSummary,
  getLoSBreakdown,
} from './los_calculator';

// Service functions (database-integrated)
export {
  // Fleet LoS retrieval
  getFleetLoS,
  getAllFleetsLoS,

  // LoS score calculation
  calcSingleFleetLoS,
  calcCombinedFleetLoS,
  calcFleetLoSForNode,
  calcFleetLoSMultiCoeff,

  // Quick calculation
  quickCalcShipLoS,
  quickCalcFleetLoS,

  // Simulation
  LoSSimulationInput,
  simulateFleetLoS,

  // Display
  LoSDisplayResult,
  getLoSDisplayResult,
} from './los_services';
