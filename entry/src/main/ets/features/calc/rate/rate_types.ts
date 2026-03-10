/**
 * Probability/Rate Calculation Types and Constants
 *
 * Common types and enums used across rate calculation modules.
 */

// ==================== Ship Position ====================

/**
 * Ship position in fleet
 */
export enum ShipPosition {
  Flagship = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
  Fifth = 5,
  Sixth = 6,
  Seventh = 7, // Striking Force only
}

/**
 * Check if ship is flagship
 */
export function isFlagship(position: ShipPosition): boolean {
  return position === ShipPosition.Flagship;
}

// ==================== Damage State ====================

/**
 * Ship damage state
 */
export enum DamageState {
  /** 無傷/小破 - Normal or Light Damage */
  Normal = 'normal',
  /** 中破 - Moderate Damage */
  Chuuha = 'chuuha',
  /** 大破 - Heavy Damage */
  Taiha = 'taiha',
  /** 撃沈 - Sunk */
  Sunk = 'sunk',
}

/**
 * Get damage state from HP ratio
 */
export function getDamageState(currentHp: number, maxHp: number): DamageState {
  if (currentHp <= 0) return DamageState.Sunk;
  const ratio = currentHp / maxHp;
  if (ratio <= 0.25) return DamageState.Taiha;
  if (ratio <= 0.5) return DamageState.Chuuha;
  return DamageState.Normal;
}

// ==================== Air State ====================

/**
 * Air control state for night recon activation
 */
export enum AirState {
  /** 制空権確保 - Air Supremacy */
  Supremacy = 'supremacy',
  /** 航空優勢 - Air Superiority */
  Superiority = 'superiority',
  /** 制空均衡 - Air Parity */
  Parity = 'parity',
  /** 航空劣勢 - Air Denial */
  Denial = 'denial',
  /** 制空権喪失 - Air Incapability */
  Incapability = 'incapability',
}

/**
 * Check if air state allows night recon activation
 * Night recon activates on: Supremacy, Superiority, Denial
 * Does NOT activate on: Parity, Incapability (in normal maps)
 * In exercises (演習), Parity also allows activation
 */
export function allowsNightRecon(airState: AirState, isExercise: boolean = false): boolean {
  switch (airState) {
    case AirState.Supremacy:
    case AirState.Superiority:
    case AirState.Denial:
      return true;
    case AirState.Parity:
      return isExercise; // Only in exercises
    case AirState.Incapability:
      return false;
    default:
      return false;
  }
}

// ==================== Formation ====================

/**
 * Fleet formation
 */
export enum Formation {
  /** 単縦陣 - Line Ahead */
  LineAhead = 'line_ahead',
  /** 複縦陣 - Double Line */
  DoubleLine = 'double_line',
  /** 輪形陣 - Diamond */
  Diamond = 'diamond',
  /** 梯形陣 - Echelon */
  Echelon = 'echelon',
  /** 単横陣 - Line Abreast */
  LineAbreast = 'line_abreast',
  /** 警戒陣 - Vanguard */
  Vanguard = 'vanguard',

  // Combined Fleet Formations
  /** 第一警戒航行序列 - Cruising Formation 1 */
  CruisingFormation1 = 'cruising_1',
  /** 第二警戒航行序列 - Cruising Formation 2 */
  CruisingFormation2 = 'cruising_2',
  /** 第三警戒航行序列 - Cruising Formation 3 */
  CruisingFormation3 = 'cruising_3',
  /** 第四警戒航行序列 - Cruising Formation 4 */
  CruisingFormation4 = 'cruising_4',
}

// ==================== Fleet Type ====================

/**
 * Fleet type for special attack
 */
export enum FleetType {
  /** 通常艦隊 - Normal Fleet */
  Normal = 'normal',
  /** 連合艦隊(水上打撃) - Combined Fleet (Surface) */
  CombinedSurface = 'combined_surface',
  /** 連合艦隊(空母機動) - Combined Fleet (Carrier) */
  CombinedCarrier = 'combined_carrier',
  /** 連合艦隊(輸送護衛) - Combined Fleet (Transport) */
  CombinedTransport = 'combined_transport',
  /** 遊撃部隊 - Striking Force */
  StrikingForce = 'striking',
}

// ==================== Common Rate Limits ====================

/** Minimum rate (0%) */
export const MIN_RATE = 0;

/** Maximum rate (100%) */
export const MAX_RATE = 100;

/** Rate cap for most calculations (99%) */
export const RATE_CAP = 99;

/**
 * Clamp rate to valid range
 */
export function clampRate(rate: number, max: number = RATE_CAP): number {
  return Math.max(MIN_RATE, Math.min(max, rate));
}

/**
 * Convert rate to probability (0-1)
 */
export function rateToProbability(rate: number): number {
  return clampRate(rate) / 100;
}

/**
 * Calculate combined probability of at least one success
 * P(at least one) = 1 - P(all fail)
 */
export function combinedSuccessRate(rates: number[]): number {
  if (rates.length === 0) return 0;

  let failProbability = 1;
  for (const rate of rates) {
    failProbability *= (1 - rateToProbability(rate));
  }

  return (1 - failProbability) * 100;
}
