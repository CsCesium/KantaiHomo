import type { QuestFleetShip, QuestFormationDefinition, QuestFormationRule } from './types';

const SHIP_TYPES: Record<string, number> = {
  DE: 1, DD: 2, CL: 3, CLT: 4, CA: 5, CAV: 6, CVL: 7, FBB: 8, BB: 9, BBV: 10,
  CV: 11, SS: 13, SSV: 14, AV: 16, LHA: 17, CVB: 18, AR: 19, AS: 20, CT: 21, AO: 22,
};

function normalizedName(name: string): string {
  return name.replace(/[\s.・]/g, '');
}
export function matchesShipName(ship: QuestFleetShip, name: string): boolean {
  return ship.names.some(candidate => normalizedName(candidate) === normalizedName(name));
}

function matchesSelector(ship: QuestFleetShip, rule: QuestFormationRule): boolean {
  const hasSelector = rule.舰 !== undefined || rule.舰型 !== undefined || rule.国籍 !== undefined;
  // Names/types, classes and nationalities in a row form one union (e.g. British ships).
  return !hasSelector || (rule.舰 ?? []).some(name => SHIP_TYPES[name] !== undefined ?
    ship.stype === SHIP_TYPES[name] : matchesShipName(ship, name)) ||
    (rule.舰型 ?? []).includes(ship.ctype) || (rule.国籍 ?? []).includes(ship.nation ?? '');
}

function satisfiesRule(fleet: QuestFleetShip[], rule: QuestFormationRule): boolean {
  const selected = fleet.filter(ship =>
    (rule.位置 === undefined || ship.position === rule.位置) &&
    (rule.等级 === undefined || ship.level >= rule.等级) && matchesSelector(ship, rule));
  let count = selected.length;
  // A named group means distinct named ships; duplicate copies cannot replace a missing member.
  if (rule.舰?.length && rule.舰.every(name => SHIP_TYPES[name] === undefined) &&
      !rule.舰型 && !rule.国籍) {
    const matched = new Map<string, number>();
    const assign = (index: number, visited: Set<string>): boolean => {
      for (const name of rule.舰 ?? []) {
        if (visited.has(name) || !matchesShipName(selected[index], name)) continue;
        visited.add(name);
        const previous = matched.get(name);
        if (previous === undefined || assign(previous, visited)) { matched.set(name, index); return true; }
      }
      return false;
    };
    selected.forEach((_ship, index) => { assign(index, new Set<string>()); });
    count = matched.size;
  }
  return (rule.大于等于 === undefined || count >= rule.大于等于) &&
    (rule.小于等于 === undefined || count <= rule.小于等于) &&
    (rule.等于 === undefined || count === rule.等于) &&
    (rule.大于等于 !== undefined || rule.小于等于 !== undefined || rule.等于 !== undefined);
}

export function satisfiesQuestFormation(
  questId: number, fleet: QuestFleetShip[], definitions: QuestFormationDefinition[]
): boolean {
  // Unknown ships or an empty fleet must never produce a positive marker.
  if (!fleet.length || fleet.some(ship => ship.masterId <= 0 || !ship.name || ship.stype <= 0)) return false;
  // Repeated IDs describe alternatives; conditions within one alternative all have to hold.
  return definitions.some(def => def.ID === questId && def.要求.length > 0 &&
    def.要求.every(rule => satisfiesRule(fleet, rule)));
}
