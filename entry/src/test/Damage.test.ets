import { describe, it, expect } from '@ohos/hypium';
import {
  NIGHT_BATTLE_CAP,
  carrierNightBasePower,
  finalPreCapModifierAttackPower,
} from '../main/ets/features/calc/damage/attack_power';
import { buildShipBattleScenarios } from '../main/ets/features/calc/damage/scenario_builder';
import {
  DayAttackType,
  type ScenarioEquip,
  type ShipScenarioInput,
} from '../main/ets/features/calc/damage/damage_types';
import { ShipType, SlotItemEquipType, SlotItemIconId } from '../main/ets/domain/models';

function makeSurfaceInput(stype: ShipType, hpNow: number): ShipScenarioInput {
  return {
    shipMasterId: 1,
    shipName: 'Test Ship',
    stype,
    level: 99,
    luck: 10,
    firepower: 100,
    torpedo: 100,
    asw: 0,
    isFlagship: false,
    hpNow,
    hpMax: 100,
    equips: [],
    fleetLoSTerm: 0,
    airState: 'supremacy',
    fleetSearchlight: false,
    fleetStarShell: false,
  };
}

function makeNightAttacker(): ScenarioEquip {
  return {
    masterId: 257,
    name: 'TBM-3D',
    equipType: SlotItemEquipType.CarrierTorpedoBomber,
    iconType: SlotItemIconId.NightAttacker,
    firepower: 2,
    torpedo: 9,
    bomb: 0,
    asw: 8,
    los: 4,
    level: 0,
    onslot: 18,
  };
}

function makeMidgetSubmarine(): ScenarioEquip {
  return {
    masterId: 41,
    name: '甲標的 甲型',
    equipType: SlotItemEquipType.MidgetSubmarine,
    iconType: SlotItemIconId.Torpedo,
    firepower: 0,
    torpedo: 12,
    bomb: 0,
    asw: 0,
    los: 0,
    level: 0,
    onslot: 0,
  };
}

function makeCarrierInput(stype: ShipType): ShipScenarioInput {
  const input = makeSurfaceInput(stype, 50);
  input.firepower = 102;
  input.torpedo = 9;
  input.equips = [makeNightAttacker()];
  return input;
}

function makeCarrierAircraft(
  equipType: SlotItemEquipType,
  name: string,
  onslot: number,
): ScenarioEquip {
  return {
    masterId: 1000 + equipType,
    name,
    equipType,
    iconType: SlotItemIconId.JetKikkaKai,
    firepower: 0,
    torpedo: 0,
    bomb: equipType === SlotItemEquipType.JetFighterBomber ? 11 : 0,
    asw: 0,
    los: 0,
    level: 0,
    onslot,
  };
}

function makeJetCarrierInput(equips: ScenarioEquip[]): ShipScenarioInput {
  const input = makeSurfaceInput(ShipType.CVB, 100);
  input.firepower = 70;
  input.torpedo = 0;
  input.equips = equips;
  return input;
}

export default function damageTest(): void {
  describe('damage', () => {
    it('calculates carrier night air attack power per embarked slot', 0, () => {
      const basePower = carrierNightBasePower(67, [
        {
          firepower: 2,
          torpedo: 9,
          bomb: 0,
          asw: 8,
          level: 0,
          onslot: 18,
          fullNightModifier: true,
        },
        {
          firepower: 0,
          torpedo: 0,
          bomb: 0,
          asw: 4,
          level: 0,
          onslot: 23,
          fullNightModifier: true,
        },
      ]);

      // Hiryuu Kai Ni + TBM-3D(18) + F6F-3N(23): 245.9 basic power.
      expect(Math.floor(basePower * 10)).assertEqual(2459);
      expect(finalPreCapModifierAttackPower(basePower, NIGHT_BATTLE_CAP, 1.2)).assertEqual(295);
    });

    it('ignores night planes in empty slots', 0, () => {
      const basePower = carrierNightBasePower(67, [{
        firepower: 2,
        torpedo: 9,
        bomb: 0,
        asw: 8,
        level: 10,
        onslot: 0,
        fullNightModifier: true,
      }]);
      expect(basePower).assertEqual(67);
    });

    it('applies current damage state before the damage cap', 0, () => {
      const chuuhaInput = makeSurfaceInput(ShipType.DD, 50);
      chuuhaInput.asw = 49;
      const chuuha = buildShipBattleScenarios(chuuhaInput);
      expect(chuuha.day[0].normal).assertEqual(73);
      expect(chuuha.asw[0].normal).assertEqual(18);
      expect(chuuha.night[0].normal).assertEqual(140);
      expect(chuuha.torpedo.length).assertEqual(0);

      const taihaInput = makeSurfaceInput(ShipType.DD, 25);
      taihaInput.asw = 49;
      const taiha = buildShipBattleScenarios(taihaInput);
      expect(taiha.day[0].normal).assertEqual(42);
      expect(taiha.asw[0].normal).assertEqual(10);
      expect(taiha.torpedo.length).assertEqual(0);
      expect(taiha.night.length).assertEqual(0);
    });

    it('keeps chuuha opening torpedo and armored carrier attacks available', 0, () => {
      const cltInput = makeSurfaceInput(ShipType.CLT, 50);
      cltInput.equips = [makeMidgetSubmarine()];
      const clt = buildShipBattleScenarios(cltInput);
      expect(clt.torpedo[0].normal).assertEqual(84);

      cltInput.hpNow = 25;
      const taihaClt = buildShipBattleScenarios(cltInput);
      expect(taihaClt.torpedo[0].normal).assertEqual(0);

      const carrier = buildShipBattleScenarios(makeCarrierInput(ShipType.CV));
      expect(carrier.day.length).assertEqual(0);
      expect(carrier.night.length).assertEqual(0);

      const armoredCarrier = buildShipBattleScenarios(makeCarrierInput(ShipType.CVB));
      expect(armoredCarrier.day.length > 0).assertTrue();
      expect(armoredCarrier.night.length > 0).assertTrue();
    });

    it('detects jet carrier cut-ins from embarked jet aircraft', 0, () => {
      const jetFighter = makeCarrierAircraft(
        SlotItemEquipType.JetFighter,
        'Jet Fighter',
        18,
      );
      const jetBomber = makeCarrierAircraft(
        SlotItemEquipType.JetFighterBomber,
        'Jet Fighter-Bomber',
        18,
      );

      const jetFb = buildShipBattleScenarios(makeJetCarrierInput([jetFighter, jetBomber]));
      expect(jetFb.day.length).assertEqual(2);
      expect(jetFb.day[0].id).assertEqual(DayAttackType.CarrierJetFB);
      expect(jetFb.day[1].id).assertEqual(DayAttackType.Normal);

      const jetFbb = buildShipBattleScenarios(makeJetCarrierInput([
        jetFighter,
        jetBomber,
        makeCarrierAircraft(SlotItemEquipType.JetFighterBomber, 'Second Jet Fighter-Bomber', 12),
      ]));
      expect(jetFbb.day.length).assertEqual(3);
      expect(jetFbb.day[0].id).assertEqual(DayAttackType.CarrierJetFBB);
      expect(jetFbb.day[1].id).assertEqual(DayAttackType.CarrierJetFB);
      expect(jetFbb.day[2].id).assertEqual(DayAttackType.Normal);
    });

    it('does not use an empty jet slot for carrier attacks', 0, () => {
      const scenarios = buildShipBattleScenarios(makeJetCarrierInput([
        makeCarrierAircraft(SlotItemEquipType.JetFighter, 'Jet Fighter', 18),
        makeCarrierAircraft(SlotItemEquipType.JetFighterBomber, 'Empty Jet Fighter-Bomber', 0),
      ]));
      expect(scenarios.day.length).assertEqual(0);
    });
  });
}
