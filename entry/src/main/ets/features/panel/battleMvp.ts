import type { BattleResultSnapshot, FleetBattleStatus, ShipBattleStatus } from '../state/type';

function mvpShip(fleet: FleetBattleStatus | undefined, position: number | undefined): ShipBattleStatus | undefined {
  if (position === undefined || !Number.isInteger(position) || position < 1) return undefined;
  return fleet?.ships[position - 1];
}

export function battleMvpShips(result: BattleResultSnapshot | null): ShipBattleStatus[] {
  if (!result || result.isAirRaid) return [];
  const ships: ShipBattleStatus[] = [];
  const main = mvpShip(result.friendMain, result.mvp);
  const escort = mvpShip(result.friendEscort, result.mvpCombined);
  if (main) ships.push(main);
  if (escort) ships.push(escort);
  return ships;
}

export function battleMvpLabel(result: BattleResultSnapshot): string {
  return battleMvpShips(result).map(ship => ship.name || '未知舰娘').join(' / ');
}
