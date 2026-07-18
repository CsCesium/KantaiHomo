import { describe, it, expect } from '@ohos/hypium';
import {
  NIGHT_BATTLE_CAP,
  carrierNightBasePower,
  finalPreCapModifierAttackPower,
} from '../main/ets/features/calc/damage/attack_power';

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
  });
}
