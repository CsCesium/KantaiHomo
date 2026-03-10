/**
 * Transport Point (TP) Module
 *
 * Provides TP calculation for transport operations in events.
 * Supports single fleet and combined fleet calculations.
 *
 * Main features:
 * - Ship type TP calculation
 * - Equipment TP calculation
 * - Special ship bonuses (e.g., Kinu Kai Ni)
 * - Combined fleet TP
 * - Gauge estimation
 */

// Type definitions and constants
export {
  // Ship types
  ShipType,
  SHIP_TYPE_TP,
  getShipTypeTP,

  // Equipment
  TransportEquipId,
  EQUIPMENT_TP,
  getEquipmentTP,
  isTransportEquipment,

  // Special ships
  SpecialTPShipId,
  SPECIAL_SHIP_TP,
  getSpecialShipTP,

  // Victory
  VictoryRank,
  VICTORY_MULTIPLIERS,
  getVictoryMultiplier,

  // Fleet types
  FleetType,
  isCombinedFleet,

  // Consumable equipment
  CONSUMABLE_TP_EQUIPMENT,
  isConsumableTPEquipment,
} from './tp_types';

// Calculator functions
export {
  // Types
  TPEquipInfo,
  ShipTPResult,
  FleetTPResult,
  CombinedFleetTPResult,
  TransportOperationResult,
  TPBreakdown,

  // Ship calculation
  calcShipTP,

  // Fleet calculation
  calcFleetTP,
  calcCombinedFleetTP,

  // Transport operation
  calcTransportOperation,

  // Utility functions
  calcTPForVictory,
  calcRemainingGauge,
  willTransportSucceed,
  calcTPNeededToOneClear,
  formatTPSummary,
  getTPBreakdown,
} from './tp_calculator';

// Service functions (database-integrated)
export {
  // Status checks
  isHeavilyDamaged,

  // Fleet TP retrieval
  getFleetTP,
  getAllFleetsTP,
  getCombinedFleetTP,

  // Transport operation
  calcSingleFleetTransport,
  calcCombinedFleetTransport,

  // Simulation
  TPSimulationInput,
  simulateFleetTP,

  // Quick calculation
  quickCalcShipTP,
  quickCalcFleetTP,
} from './tp_service';
