/**
 * Probability/Rate Calculation Module
 *
 * Provides rate calculations for various game mechanics:
 *
 * 1. Night Reconnaissance (夜間触接)
 *    - Activation rate based on equipment LoS and ship level
 *    - Formula: rate = √(equip_los × ship_level) × 4 [%]
 *    - Effects: Attack power +5/+7, Accuracy +10%
 *
 * 2. Night Battle Cut-In (夜戦カットイン)
 *    - Activation rate based on luck, level, and equipment
 *    - Various types: Torpedo CI, Main Gun CI, etc.
 *    - Bonuses from flagship, damage, searchlight, star shell
 *
 * 3. Battleship Special Attacks (特殊攻撃)
 *    - Nelson Touch, Nagato/Mutsu Touch, Colorado Touch, etc.
 *    - Activation rate based on ship levels and luck
 *    - Formation requirements
 */

// Common types
export {
  // Enums
  ShipPosition,
  DamageState,
  Formation,

  // Functions
  isFlagship,
  getDamageState,
  allowsNightRecon,

  // Rate utilities
  MIN_RATE,
  MAX_RATE,
  RATE_CAP,
  clampRate,
  rateToProbability,
  combinedSuccessRate,
} from './rate_types';

// Night Reconnaissance
export {
  // Types
  NightReconEquipInfo,
  NightReconSlot,
  ShipNightReconInput,
  FleetNightReconResult,

  // Data
  NIGHT_RECON_EQUIPMENT,
  NIGHT_RECON_100_LEVELS,

  // Functions
  isNightReconEquipment,
  getNightReconInfo,
  calcNightReconRate,
  calcNightReconRateByEquip,
  calcShipNightReconRate,
  calcFleetNightReconRate,
  calcLevelFor100Percent,
  getLevelRequirementsFor100,
  canAchieve100Percent,
  formatNightReconResult,
} from './night_recon_rate';

// Night Battle Cut-In
export {
  // Types
  NightCutInType,
  NightEquipmentType,
  FleetEquipBonus,
  ShipEquipBonus,
  NightCutInInput,
  NightCutInResult,

  // Constants
  CUTIN_TYPE_COEFFICIENT,
  FLAGSHIP_BONUS,
  CHUUHA_BONUS,
  SEARCHLIGHT_BONUS,
  STAR_SHELL_BONUS,
  SKILLED_LOOKOUT_BONUS,
  SURFACE_RADAR_LOOKOUT_BONUS,
  LUCK_CAP,

  // Functions
  calcCITerm,
  calcPositionBonus,
  calcDamageBonus,
  calcFleetEquipBonus,
  calcShipEquipBonus,
  calcNightCutInRate,
  quickCalcNightCutInRate,
  generateCutInRateTable,
  calcRequiredLuckForRate,
  formatNightCutInResult,
  getCutInTypeName,
} from './night_cutin_rate';

// Battleship Special Attacks
export {
  // Types
  SpecialAttackType,
  SpecialAttackPositions,
  SpecialAttackInput,
  SpecialAttackResult,

  // Data
  SPECIAL_ATTACK_FLAGSHIP_IDS,
  SPECIAL_ATTACK_PARTNER_SPECS,

  // Functions
  getAttackPositions,
  allowsSpecialAttack,
  detectFleetSpecialAttack,
  getSpecialAttackShortLabel,
  calcNelsonTouchRate,
  calcNagatoTouchRate,
  calcColoradoTouchRate,
  calcYamatoTouchRate,
  calcSpecialAttackRate,
  quickCalcSpecialAttackRate,
  getSpecialAttackTypeName,
  formatSpecialAttackResult,
  generateExampleRates,
} from './special_attack_rate';
