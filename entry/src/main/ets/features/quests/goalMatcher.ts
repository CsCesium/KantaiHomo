import type { QuestCountEvent, QuestFleetShip, QuestGoal, QuestShipConstraint } from './types';

function accepts(values: number[] | undefined, value: number | undefined): boolean {
  return values === undefined || (value !== undefined && values.includes(value));
}
function hasId(ship: QuestFleetShip | undefined, ids: number[] | undefined): boolean {
  return ids === undefined || (ship !== undefined && ship.ancestors.some(id => ids.includes(id)));
}
function matchesGroup(fleet: QuestFleetShip[], group: QuestShipConstraint, kind: string): boolean {
  return fleet.filter(ship => (!group[2] || ship.position !== 1) &&
    (kind === 'id' ? hasId(ship, group[0]) : group[0].includes(kind === 'type' ? ship.stype : ship.ctype)))
    .length >= group[1];
}
export function matchesQuestGoal(goal: QuestGoal, event: QuestCountEvent): boolean {
  if (goal.event !== event.event || !Number.isFinite(event.delta) || event.delta <= 0) return false;
  if (!accepts(goal.maparea, event.maparea) || !accepts(goal.mapcell, event.mapcell) ||
      !accepts(goal.shipType, event.shipType) || !accepts(goal.slotitemType2, event.slotitemType2) ||
      !accepts(goal.slotitemId, event.slotitemId) || !accepts(goal.times, event.times)) return false;
  if (goal.mission && !goal.mission.includes(event.mission ?? '')) return false;
  if (goal.materialShipType && (event.materialShipTypes ?? []).filter(type =>
    goal.materialShipType?.includes(type)).length < (goal.materialShipMinCount ?? 3)) return false;
  const fleet = event.fleet ?? [];
  const first = fleet.find(ship => ship.position === 1);
  const second = fleet.find(ship => ship.position === 2);
  if (!hasId(first, goal.flagshipId) || !hasId(second, goal.secondshipId) ||
    !accepts(goal.flagshiptype, first?.stype) || !accepts(goal.flagshipclass, first?.ctype) ||
    !accepts(goal.secondshipclass, second?.ctype)) return false;
  if (goal.fleetlimit !== undefined && (!fleet.length || fleet.length > goal.fleetlimit)) return false;
  if (goal.banshiptype && (!fleet.length || fleet.some(ship => goal.banshiptype?.includes(ship.stype)))) return false;
  if (goal.escortshipId?.length && !goal.escortshipId.some(group => matchesGroup(fleet, group, 'id'))) return false;
  return (goal.escortshipIdAll ?? []).every(group => matchesGroup(fleet, group, 'id')) &&
    (goal.escortshiptype ?? []).every(group => matchesGroup(fleet, group, 'type')) &&
    (goal.escortshipclass ?? []).every(group => matchesGroup(fleet, group, 'class'));
}
