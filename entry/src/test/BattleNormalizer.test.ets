import { describe, it, expect } from '@ohos/hypium';
import { normalizeBattleSegment } from '../main/ets/domain/models/normalizer/battle';
import { predictEnemyNightFleet } from '../main/ets/features/state/enemy_night_fleet';

export default function battleNormalizerTest() {
  describe('battleNormalizer', () => {
    it('normalizes base air raid air state and damage', 0, () => {
      const raw: any = {
        api_data: {
          api_destruction_battle: {
            api_f_nowhps: [200, 200, 200],
            api_f_maxhps: [200, 200, 200],
            api_e_nowhps: [],
            api_e_maxhps: [],
            api_air_base_attack: {
              api_stage1: {
                api_disp_seiku: 0,
                api_f_count: 40,
                api_f_lostcount: 4,
                api_e_count: 24,
                api_e_lostcount: 3,
              },
              api_stage2: null,
              api_stage3: {
                api_fdam: [0, 50.8, 199.9],
              },
            },
            api_lost_kind: 2,
          },
        },
      };

      const segment = normalizeBattleSegment('api_req_map/next', raw, { now: 1 });
      expect(segment !== null).assertTrue();
      if (!segment) return;

      // Raw api_disp_seiku=0 is parity; the panel/storage enum represents it as 3.
      expect(segment.meta.airState).assertEqual(3);
      expect(segment.meta.lbasWaves?.length).assertEqual(1);
      expect(segment.meta.airRaidDamageKind).assertEqual(2);
      expect(segment.end.friend.main.now[0]).assertEqual(200);
      expect(segment.end.friend.main.now[1]).assertEqual(150);
      expect(segment.end.friend.main.now[2]).assertEqual(1);
    });

    it('predicts the enemy combined fleet night target', 0, () => {
      const healthy = { hpAfter: 30, hpMax: 30, isTaiha: false, isChuuha: false };
      const sunk = { hpAfter: 0, hpMax: 30, isTaiha: false, isChuuha: false };

      expect(predictEnemyNightFleet([healthy, healthy, healthy, healthy, healthy, healthy])).assertEqual('escort');
      expect(predictEnemyNightFleet([sunk, healthy, healthy])).assertEqual('main');
      // Exactly 3 points does not meet the "less than 3" main-fleet condition.
      expect(predictEnemyNightFleet([sunk, healthy, healthy, healthy])).assertEqual('escort');
    });
  });
}
