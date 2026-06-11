/**
 * Day Battle Cut-In (弾着観測射撃 / 戦爆連合) Activation Rate Calculator
 *
 * Estimated trigger rate model (観測項方式):
 *
 *   観測項 K = ⌊艦隊索敵項 × 索敵係数⌋ + ⌊√運⌋ + 10 + 旗艦補正 + 制空補正
 *     - 索敵係数: 制空権確保 0.7 / 航空優勢 0.6
 *     - 旗艦補正: +15
 *     - 制空補正: 確保時 +10
 *   発動率 = K / 種別係数
 *
 *   艦隊索敵項 = Σ(偵察機索敵×2) + Σ(電探索敵) + Σ⌊√(各艦素索敵)⌋
 *
 * 種別係数: 主主CI 150, 主徹CI 140, 主電CI 130, 主副CI 120, 連撃 130.
 * Carrier cut-in (戦爆連合) coefficients use the same observation-term formula.
 *
 * Reference: https://wikiwiki.jp/kancolle/弾着観測射撃
 */

import { DayAttackType, ScenarioAirState } from './damage_types';

// ==================== Type Coefficients (種別係数) ====================

const DAY_CI_COEFFICIENT = new Map<DayAttackType, number>([
  [DayAttackType.MainMainCI, 150],
  [DayAttackType.MainApCI, 140],
  [DayAttackType.MainRadarCI, 130],
  [DayAttackType.MainSecCI, 120],
  [DayAttackType.DoubleAttack, 130],
  [DayAttackType.CarrierFBA, 125],
  [DayAttackType.CarrierBBA, 140],
  [DayAttackType.CarrierBA, 155],
  [DayAttackType.CarrierJetFBB, 135],
  [DayAttackType.CarrierJetFB, 125],
  [DayAttackType.CarrierJetFBA, 115],
]);

/** Maximum trigger rate for a single roll */
const DAY_CI_RATE_CAP = 0.99;

// ==================== Observation Term ====================

export interface ObservationTermInput {
  /** Ship displayed luck */
  luck: number;
  /** Fleet LoS term (see module doc) */
  fleetLoSTerm: number;
  isFlagship: boolean;
  airState: ScenarioAirState;
}

/**
 * Calculate the observation term (観測項) shared by all day cut-in rolls.
 */
export function calcObservationTerm(input: ObservationTermInput): number {
  const losFactor = input.airState === 'supremacy' ? 0.7 : 0.6;
  const supremacyBonus = input.airState === 'supremacy' ? 10 : 0;
  const flagshipBonus = input.isFlagship ? 15 : 0;

  return Math.floor(input.fleetLoSTerm * losFactor)
    + Math.floor(Math.sqrt(Math.max(0, input.luck)))
    + 10
    + flagshipBonus
    + supremacyBonus;
}

/**
 * Single-roll trigger rate (0..1) of a day attack type, before priority
 * chaining against higher-priority types.
 */
export function calcDayAttackRate(type: DayAttackType, observationTerm: number): number {
  const coefficient = DAY_CI_COEFFICIENT.get(type);
  if (coefficient === undefined || coefficient <= 0) return 0;
  const rate = observationTerm / coefficient;
  return Math.max(0, Math.min(DAY_CI_RATE_CAP, rate));
}
