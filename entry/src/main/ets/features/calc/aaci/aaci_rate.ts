/**
 * AACI Trigger Rate Calculator
 *
 * 参考:
 * - https://wikiwiki.jp/kancolle/対空砲火
 * - 制空権シミュレータ
 */
import { DetectedAaci } from "./aaci_detector";

// ==================== 発動率計算定数 ====================

/**
 * 対空電探装備時の発動率補正
 * 対空電探を装備すると発動率が上昇
 */
export const RADAR_RATE_BONUS = 0.05;

/**
 * 艦隊位置補正 (旗艦など)
 */
export const FLAGSHIP_RATE_BONUS = 0.05;

/**
 * 運による補正係数
 * 推定: 発動率 += luck * 0.001
 */
export const LUCK_RATE_COEFFICIENT = 0.001;

// ========================================


/**
 * 単一 AACI の発動率を計算
 *
 * @param aaci 検出された AACI
 * @param hasRadar 対空電探装備の有無
 * @param luck 艦娘の運
 * @param isFlagship 旗艦かどうか
 * @returns 発動率 (0-1)
 */
export function calcSingleAaciRate(
  aaci: DetectedAaci,
  hasRadar: boolean = false,
  luck: number = 0,
  isFlagship: boolean = false,
): number {
  // 基本発動率
  let rate = aaci.info.baseRate;

  // 対空電探補正
  if (hasRadar) {
    rate += RADAR_RATE_BONUS;
  }

  // 旗艦補正
  if (isFlagship) {
    rate += FLAGSHIP_RATE_BONUS;
  }

  // 運補正
  rate += luck * LUCK_RATE_COEFFICIENT;

  // 0-1 の範囲にクランプ
  return Math.max(0, Math.min(1, rate));
}

/**
 * 複数 AACI の複合発動率を計算
 *
 * 2023年5月のアップデートで全艦が複数判定可能に
 * 複合発動率 = 1 - Π(1 - 個別発動率)
 *
 * @param aacis 検出された AACI 一覧
 * @param hasRadar 対空電探装備の有無
 * @param luck 艦娘の運
 * @param isFlagship 旗艦かどうか
 * @returns 総合発動率 (0-1)
 */
export function calcCombinedAaciRate(
  aacis: DetectedAaci[],
  hasRadar: boolean = false,
  luck: number = 0,
  isFlagship: boolean = false,
): number {
  if (aacis.length === 0) {
    return 0;
  }

  // 各 AACI の不発率を乗算
  let notTriggerProb = 1;
  for (const aaci of aacis) {
    const rate = calcSingleAaciRate(aaci, hasRadar, luck, isFlagship);
    notTriggerProb *= (1 - rate);
  }

  // 複合発動率 = 1 - 不発確率
  return 1 - notTriggerProb;
}