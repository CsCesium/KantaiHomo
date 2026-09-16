import type { QuestFleetShip } from './types';

export interface QuestShipMaster { id: number; name: string; stype: number | null; ctype: number | null; afterShipId: number | null; }
export class QuestShipCatalog {
  private masters = new Map<number, QuestShipMaster>();
  private parents = new Map<number, number[]>();
  private nations: Record<string, number[]> = {};
  setNations(nations: Record<string, number[]>): void { this.nations = nations; }
  setMasters(masters: QuestShipMaster[]): void {
    this.masters.clear(); this.parents.clear();
    for (const master of masters) {
      this.masters.set(master.id, master);
      if (master.afterShipId && master.afterShipId !== master.id) {
        const parents = this.parents.get(master.afterShipId) ?? [];
        parents.push(master.id); this.parents.set(master.afterShipId, parents);
      }
    }
  }
  ship(uid: number, masterId: number, level: number, position: number): QuestFleetShip {
    const master = this.masters.get(masterId);
    const ancestors: number[] = [];
    const visit = (id: number): void => {
      if (ancestors.includes(id)) return;
      ancestors.push(id);
      (this.parents.get(id) ?? []).forEach(visit);
    };
    visit(masterId);
    const ctype = master?.ctype ?? 0;
    return { uid, masterId, level, position, name: master?.name ?? '', stype: master?.stype ?? 0,
      ctype, ancestors, names: ancestors.map(id => this.masters.get(id)?.name ?? '').filter(name => !!name),
      nation: Object.keys(this.nations).find(nation => this.nations[nation].includes(ctype)) };
  }
  stype(masterId: number): number { return this.masters.get(masterId)?.stype ?? 0; }
}
