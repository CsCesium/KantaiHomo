import { describe, it, expect } from '@ohos/hypium';
import {
  SlotItemAircraftCategory,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemMajorType,
} from '../main/ets/domain/models';
import type { SlotItemMaster } from '../main/ets/domain/models';
import {
  AirState,
  PROFICIENCY_INTERNAL_MAX,
  PROFICIENCY_INTERNAL_MIN,
  calcAirStateThresholds,
  calcImprovementBonus,
  calcLbasAirCorpsFighterPower,
  calcLbasSquadronFighterPower,
  calcLbasSortieFighterPower,
  calcLbasSortieFighterPowerRange,
  calcSlotFighterPower,
  determineAirState,
  getLbasDefenseReconBonus,
  getLbasSortieReconBonus,
  isLbasAirCombatEquip,
} from '../main/ets/features/calc';

function makeAircraftMaster(
  id: number,
  equipType: SlotItemEquipType,
  aa: number,
  hit: number = 0,
  evasion: number = 0,
  los: number = 0,
): SlotItemMaster {
  return {
    id,
    sortNo: 0,
    name: `Equip#${id}`,
    type: {
      major: 0 as SlotItemMajorType,
      book: 0 as SlotItemBookCategory,
      equipType,
      iconId: 0 as SlotItemIconId,
      aircraft: 0 as SlotItemAircraftCategory,
    },
    rarity: 0,
    range: 0,
    stats: {
      hp: 0,
      armor: 0,
      firepower: 0,
      torpedo: 0,
      speed: 0,
      bomb: 0,
      aa,
      asw: 0,
      hit,
      evasion,
      los,
      luck: 0,
    },
    broken: [0, 0, 0, 0],
    updatedAt: 0,
  };
}

export default function fighterPowerTest(): void {
  describe('fighterPower', () => {
    it('applies fighter-power improvement coefficients by type and equipment', 0, () => {
      expect(calcImprovementBonus(SlotItemEquipType.CarrierFighter, 1, 10)).assertEqual(2);
      expect(calcImprovementBonus(SlotItemEquipType.CarrierDiveBomber, 60, 10)).assertEqual(2.5);
      expect(calcImprovementBonus(SlotItemEquipType.CarrierFighter, 486, 10)).assertEqual(3);
      expect(calcImprovementBonus(SlotItemEquipType.CarrierDiveBomber, 487, 10)).assertEqual(3);
      expect(calcImprovementBonus(SlotItemEquipType.LandAttacker, 1, 9)).assertEqual(1.5);
      expect(calcImprovementBonus(SlotItemEquipType.HeavyBomber, 1, 9)).assertEqual(1.5);
    });

    it('uses the verified displayed-to-internal proficiency ranges', 0, () => {
      expect(PROFICIENCY_INTERNAL_MAX[5]).assertEqual(84);
      expect(PROFICIENCY_INTERNAL_MIN[6]).assertEqual(85);

      const fighter = makeAircraftMaster(1, SlotItemEquipType.CarrierFighter, 1);
      const power = calcSlotFighterPower(fighter, 3, 0, 7);
      expect(power.fighterPowerMin).assertEqual(26);
      expect(power.fighterPowerMax).assertEqual(27);
    });

    it('includes exact one-third and two-thirds air-state boundaries', 0, () => {
      expect(determineAirState(2, 3)).assertEqual(AirState.Parity);
      expect(determineAirState(1, 3)).assertEqual(AirState.Denial);

      const thresholds = calcAirStateThresholds(100);
      expect(thresholds.parity).assertEqual(67);
      expect(thresholds.denial).assertEqual(34);
    });

    it('counts LBAS recon, heavy bombers, and land-attacker improvements', 0, () => {
      expect(isLbasAirCombatEquip(SlotItemEquipType.CarrierRecon)).assertTrue();
      expect(isLbasAirCombatEquip(SlotItemEquipType.SeaplaneRecon)).assertTrue();
      expect(isLbasAirCombatEquip(SlotItemEquipType.LargeFlyingBoat)).assertTrue();
      expect(isLbasAirCombatEquip(SlotItemEquipType.HeavyBomber)).assertTrue();

      const landAttacker = makeAircraftMaster(1, SlotItemEquipType.LandAttacker, 0);
      expect(calcLbasSortieFighterPower(landAttacker, 18, 9, 0)).assertEqual(7);

      const carrierRecon = makeAircraftMaster(2, SlotItemEquipType.CarrierRecon, 1, 2, 2);
      expect(calcLbasSortieFighterPower(carrierRecon, 4, 0, 7)).assertEqual(5);

      const heavyBomber = makeAircraftMaster(3, SlotItemEquipType.HeavyBomber, 1);
      expect(calcLbasSortieFighterPower(heavyBomber, 9, 0, 0)).assertEqual(3);
    });

    it('exposes an LBAS range when hidden proficiency can change fighter power', 0, () => {
      // Carrier-aircraft evasion is not the LBAS interception stat.
      const fighter = makeAircraftMaster(1, SlotItemEquipType.CarrierFighter, 1, 2, 2);
      const range = calcLbasSortieFighterPowerRange(fighter, 3, 0, 7);
      expect(range.min).assertEqual(26);
      expect(range.max).assertEqual(27);
    });

    it('applies sortie and defense reconnaissance multipliers by type and LoS', 0, () => {
      expect(getLbasSortieReconBonus(SlotItemEquipType.LandRecon, 8)).assertEqual(1.15);
      expect(getLbasSortieReconBonus(SlotItemEquipType.LandRecon, 9)).assertEqual(1.18);
      expect(getLbasDefenseReconBonus(SlotItemEquipType.CarrierRecon, 9)).assertEqual(1.30);
      expect(getLbasDefenseReconBonus(SlotItemEquipType.LandRecon, 9)).assertEqual(1.23);
      expect(getLbasDefenseReconBonus(SlotItemEquipType.SeaplaneRecon, 8)).assertEqual(1.13);

      const fighter = calcLbasSquadronFighterPower(
        makeAircraftMaster(1, SlotItemEquipType.CarrierFighter, 10),
        0,
        7,
        18,
      );
      const landRecon = calcLbasSquadronFighterPower(
        makeAircraftMaster(311, SlotItemEquipType.LandRecon, 0, 0, 0, 8),
        0,
        0,
        4,
      );
      const corps = calcLbasAirCorpsFighterPower(1, [fighter, landRecon]);
      expect(corps.totalSortieFighterPower).assertEqual(77);
      expect(corps.totalDefenseFighterPower).assertEqual(79);
    });
  });
}
