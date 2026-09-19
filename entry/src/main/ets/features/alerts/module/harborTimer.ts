import type { GameState, ShipState } from '../../state/type';

export type HarborTimerKind = 'repair' | 'supply';
export const HARBOR_TIMER_ENABLED = 'alerts.harbor.enabled';
export const HARBOR_TIMER_KINDS: HarborTimerKind[] = ['repair', 'supply'];
export const HARBOR_INTERVAL_REPAIR = 20 * 60000;
export const HARBOR_INTERVAL_SUPPLY = 15 * 60000;
export interface HarborStage {
  toastShown: boolean;
  systemScheduled: boolean;
  notificationSent: boolean;
}
export interface HarborClock extends HarborStage {
  kind: HarborTimerKind;
  startedAt: number;
  supplyFinal?: HarborStage;
}
export interface HarborFleet {
  kind: HarborTimerKind;
  deckId: number;
  flagship: string;
}
export interface HarborTimerView extends HarborFleet {
  dueAt: number;
  startedAt: number;
  finalSupply: boolean;
}

export function harborInterval(kind: HarborTimerKind): number {
  return kind === 'repair' ? HARBOR_INTERVAL_REPAIR : HARBOR_INTERVAL_SUPPLY;
}
export function harborFlagshipKind(name: string): HarborTimerKind | null {
  if (name === '明石' || name === '明石改') return 'repair';
  if (name === '野埼' || name === '野埼改') return 'supply';
  return null;
}

/** Flagship-only scope. Check actual recipients, repair facilities, docks and Nosaki's supplies. */
export function eligibleHarborFleets(state: GameState, awayDecks: number[]): HarborFleet[] {
  const docked = new Set(state.Ndocks.filter(dock => dock.state > 0 && dock.shipUid > 0).map(dock => dock.shipUid));
  const result: HarborFleet[] = [];
  for (const deck of state.decks) {
    if (awayDecks.includes(deck.deckId) || deck.expeditionReturnTime !== null) continue;
    const flagship = state.ships.get(deck.shipUids[0]);
    if (!flagship || docked.has(flagship.uid) || flagship.hpMax <= 0) continue;
    const kind = harborFlagshipKind(flagship.name);
    if (!kind) continue;
    const ships: ShipState[] = [];
    for (const uid of deck.shipUids) {
      const ship = state.ships.get(uid);
      if (ship) ships.push(ship);
    }
    if (kind === 'repair') {
      if (flagship.hpNow / flagship.hpMax <= 0.5) continue;
      const facilities = flagship.slots.filter(uid => state.slotItemIndex.get(uid) === 86).length;
      const recipients = ships.slice(0, 2 + facilities);
      if (!recipients.some(ship => !docked.has(ship.uid) && ship.hpNow < ship.hpMax && ship.hpNow / ship.hpMax > 0.5)) continue;
      if (state.materials && (state.materials.fuel <= 0 || state.materials.steel <= 0)) continue;
    } else {
      if (flagship.hpNow / flagship.hpMax <= 0.75 || flagship.cond < 30 ||
          flagship.fuelMax <= 0 || flagship.ammoMax <= 0 ||
          flagship.fuel < flagship.fuelMax || flagship.ammo < flagship.ammoMax) continue;
      if (!ships.slice(1).some(ship => !docked.has(ship.uid) && ship.cond < 54)) continue;
      if (state.materials && state.materials.fuel <= 0) continue;
    }
    result.push({ kind, deckId: deck.deckId, flagship: flagship.name });
  }
  return result;
}

export class HarborTimer {
  private clocks = new Map<HarborTimerKind, HarborClock>();
  restore(text: string, now: number): void {
    this.clocks.clear();
    if (!text) return;
    const saved = JSON.parse(text) as HarborClock[];
    if (!Array.isArray(saved)) return;
    for (const clock of saved) {
      if (HARBOR_TIMER_KINDS.includes(clock.kind) && Number.isFinite(clock.startedAt) && clock.startedAt > 0 && clock.startedAt <= now) {
        if (clock.kind === 'supply' && !clock.supplyFinal) clock.supplyFinal = this.newStage();
        this.clocks.set(clock.kind, clock);
      }
    }
  }
  serialize(): string { return JSON.stringify(Array.from(this.clocks.values())); }
  clock(kind: HarborTimerKind): HarborClock | undefined { return this.clocks.get(kind); }
  private newStage(): HarborStage { return { toastShown: false, systemScheduled: false, notificationSent: false }; }
  stage(view: HarborTimerView): HarborStage {
    const clock = this.clocks.get(view.kind)!;
    return view.finalSupply ? clock.supplyFinal! : clock;
  }
  reset(kind: HarborTimerKind, now: number): void {
    this.clocks.set(kind, { kind, startedAt: now, toastShown: false, systemScheduled: false, notificationSent: false,
      supplyFinal: kind === 'supply' ? this.newStage() : undefined });
  }
  observe(kinds: HarborTimerKind[], now: number): void {
    for (const kind of kinds) if (!this.clocks.has(kind) || this.clocks.get(kind)!.startedAt > now) this.reset(kind, now);
  }
  port(fleets: HarborFleet[], now: number): void {
    // Entering port before the threshold must not reset the shared game timer.
    for (const kind of HARBOR_TIMER_KINDS) {
      const clock = this.clocks.get(kind);
      if (clock && fleets.some(fleet => fleet.kind === kind) && now >= clock.startedAt + harborInterval(kind)) this.reset(kind, now);
    }
  }
  views(fleets: HarborFleet[]): HarborTimerView[] {
    const result: HarborTimerView[] = [];
    for (const fleet of fleets) {
      const clock = this.clocks.get(fleet.kind);
      if (!clock) continue;
      result.push({ ...fleet, startedAt: clock.startedAt, dueAt: clock.startedAt + harborInterval(fleet.kind), finalSupply: false });
      if (fleet.kind === 'supply') result.push({ ...fleet, startedAt: clock.startedAt,
        dueAt: clock.startedAt + 2 * HARBOR_INTERVAL_SUPPLY, finalSupply: true });
    }
    return result.sort((a, b) => a.dueAt - b.dueAt || a.deckId - b.deckId);
  }
}
