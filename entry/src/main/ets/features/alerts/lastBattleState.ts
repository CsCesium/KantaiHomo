/**
 * 在战斗结算与下一次进入节点提醒之间共享大破击沉风险状态
 *
 * 由 handleBattleResult 写入，由 handleSortieNext / handleBattleStart /
 * WebHostController（进击提醒）读取。
 */

let _lastBattleHasTaihaRisk = false;

/** 战斗结算后写入本次大破击沉风险 */
export function setLastBattleHasTaihaRisk(risk: boolean): void {
  _lastBattleHasTaihaRisk = risk;
}

/** 读取上一场战斗结算后的大破击沉风险 */
export function getLastBattleHasTaihaRisk(): boolean {
  return _lastBattleHasTaihaRisk;
}

/** 出击开始时重置（新出击前无历史战斗） */
export function resetLastBattleState(): void {
  _lastBattleHasTaihaRisk = false;
}
