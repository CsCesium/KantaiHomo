import {
  CurrentBattleState,
  FleetBattleStatus,
  ShipBattleStatus,
  ShipState,
} from './type';

export function pickSourceFleet(
  deckId: number,
  battle: CurrentBattleState,
): FleetBattleStatus | undefined {
  const result = battle.result;
  if (!result) return undefined;
  if (result.friendMain?.deckId === deckId) return result.friendMain;
  if (result.friendEscort?.deckId === deckId) return result.friendEscort;
  return undefined;
}

export function buildHpOverrideMap(
  fleet: FleetBattleStatus | undefined,
): Map<number, ShipBattleStatus> {
  const m = new Map<number, ShipBattleStatus>();
  if (!fleet) return m;
  for (const s of fleet.ships) {
    m.set(s.uid, s);
  }
  return m;
}

export function applyBattleHp(
  base: ShipState,
  overrides: Map<number, ShipBattleStatus>,
): ShipState {
  const bss = overrides.get(base.uid);
  if (!bss) return base;
  return {
    uid:           base.uid,
    masterId:      base.masterId,
    name:          base.name,
    level:         base.level,
    expToNext:     base.expToNext,
    hpNow:         bss.hpAfter,
    hpMax:         bss.hpMax,
    cond:          base.cond,
    fuel:          base.fuel,
    ammo:          base.ammo,
    fuelMax:       base.fuelMax,
    ammoMax:       base.ammoMax,
    scoutCur:      base.scoutCur,
    aswCur:        base.aswCur,
    speed:         base.speed,
    needsResupply: base.needsResupply,
    slotCount:     base.slotCount,
    slots:         base.slots,
    onslot:        base.onslot,
    exSlot:        base.exSlot,
    hpPercent:     bss.hpPercent,
    isTaiha:       bss.isTaiha,
    isChuuha:      bss.isChuuha,
  };
}
