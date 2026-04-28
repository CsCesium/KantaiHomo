/**
 * 在战斗结算与下一次进入节点提醒之间共享大破击沉风险状态
 *
 * 由 handleBattleResult 写入，由 handleSortieNext / handleBattleStart /
 * WebHostController（进击提醒）读取。
 */

export interface LastBattleTaihaShip {
  uid: number;
  name: string;
  hpAfter: number;
  hpMax: number;
}

let _lastBattleHasTaihaRisk = false;
let _lastBattleTaihaShips: LastBattleTaihaShip[] = [];

/** 战斗结算后写入本次大破击沉风险 */
export function setLastBattleHasTaihaRisk(risk: boolean): void {
  _lastBattleHasTaihaRisk = risk;
}

/** 读取上一场战斗结算后的大破击沉风险 */
export function getLastBattleHasTaihaRisk(): boolean {
  return _lastBattleHasTaihaRisk;
}

/** 战斗结算后写入大破舰娘列表（用于下一节点的 TaihaWarningAlert） */
export function setLastBattleTaihaShips(ships: LastBattleTaihaShip[]): void {
  _lastBattleTaihaShips = ships;
}

/** 读取上一场战斗大破舰娘列表 */
export function getLastBattleTaihaShips(): LastBattleTaihaShip[] {
  return _lastBattleTaihaShips;
}

/** 出击开始时重置（新出击前无历史战斗） */
export function resetLastBattleState(): void {
  _lastBattleHasTaihaRisk = false;
  _lastBattleTaihaShips = [];
}
