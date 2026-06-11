import {
  BattleStatusSnapshot,
  ShipState,
  getBattleStatus,
  getGameState,
  getSpecialAttackTriggeredShipCounts,
  getSpecialAttackTriggeredShipUids,
  getUseItemCountByName,
} from '../state';
import {
  SpecialAttackFleetRole,
  SpecialAttackFleetShip,
  SpecialAttackType,
  detectFleetSpecialAttacks,
  getSpecialAttackShortLabel,
} from '../calc';
import { getSortieContext } from '../../domain/service/sortie';

const SUBMARINE_SUPPLY_MATERIAL_NAME = '潜水艦補給物資';
const PT_IMP_MASTER_IDS: Set<number> = new Set([1637, 1638, 1639, 1640]);

function resolveFleetRole(activeFleet: number, combinedType: number): SpecialAttackFleetRole {
  if (combinedType <= 0) return 'normal';
  if (activeFleet === 0) return 'main';
  if (activeFleet === 1) return 'escort';
  return 'other';
}

function resolveCombinedType(): number {
  const battleStatus = getBattleStatus();
  if (battleStatus !== null) return battleStatus.combinedType;
  const sortieContext = getSortieContext();
  return sortieContext?.combinedType ?? 0;
}

function toSpecialAttackShip(ship: ShipState, shipMasterStype: Map<number, number>): SpecialAttackFleetShip {
  return {
    uid: ship.uid,
    masterId: ship.masterId,
    stype: shipMasterStype.get(ship.masterId) ?? 0,
    level: ship.level,
    hpNow: ship.hpNow,
    hpMax: ship.hpMax,
  };
}

function hasPtEnemy(shipIds: ReadonlyArray<number>): boolean {
  return shipIds.some((shipId: number): boolean => PT_IMP_MASTER_IDS.has(shipId));
}

function isPtNode(battleStatus: BattleStatusSnapshot | null): boolean {
  if (battleStatus === null) return false;
  if (hasPtEnemy(battleStatus.enemyMain.shipIds)) return true;
  return battleStatus.enemyEscort !== undefined && hasPtEnemy(battleStatus.enemyEscort.shipIds);
}

function isCombinedRouteNightBattle(battleStatus: BattleStatusSnapshot | null, combinedType: number): boolean {
  return combinedType > 0 && battleStatus !== null && battleStatus.battlePhase !== 'day';
}

function isTwoWayAirBattleNight(battleStatus: BattleStatusSnapshot | null): boolean {
  if (battleStatus === null || battleStatus.battlePhase === 'day') return false;
  return (battleStatus.battleApiPath ?? '').indexOf('airbattle') >= 0;
}

export function detectSpecialAttackBadges(
  rawShips: ReadonlyArray<ShipState>,
  activeFleet: number,
): string[] {
  const battleStatus = getBattleStatus();
  const combinedType = resolveCombinedType();
  const state = getGameState().getState();
  const ships = rawShips.map((ship: ShipState): SpecialAttackFleetShip =>
    toSpecialAttackShip(ship, state.shipMasterStype));
  const attackTypes: SpecialAttackType[] = detectFleetSpecialAttacks(ships, {
    triggeredShipUids: getSpecialAttackTriggeredShipUids(),
    triggeredShipCounts: getSpecialAttackTriggeredShipCounts(),
    fleetRole: resolveFleetRole(activeFleet, combinedType),
    combinedType,
    formation: battleStatus?.friendFormation,
    isPractice: battleStatus?.isPractice,
    enemyCombined: battleStatus !== null ? battleStatus.enemyEscort !== undefined : undefined,
    isNightBattle: battleStatus !== null ? battleStatus.battlePhase !== 'day' : undefined,
    isCombinedRouteNightBattle: isCombinedRouteNightBattle(battleStatus, combinedType),
    isPtNode: isPtNode(battleStatus),
    isTwoWayAirBattleNight: isTwoWayAirBattleNight(battleStatus),
    hasSubmarineSupplyMaterial: getUseItemCountByName(SUBMARINE_SUPPLY_MATERIAL_NAME) > 0,
  });
  return attackTypes.map((attackType: SpecialAttackType): string => getSpecialAttackShortLabel(attackType));
}

export function detectSpecialAttackBadge(
  rawShips: ReadonlyArray<ShipState>,
  activeFleet: number,
): string {
  const labels = detectSpecialAttackBadges(rawShips, activeFleet);
  return labels.length > 0 ? labels[0] : '';
}
