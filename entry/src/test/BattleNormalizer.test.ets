import { describe, it, expect } from '@ohos/hypium';
import { normalizeBattleSegment } from '../main/ets/domain/models/normalizer/battle';
import { predictEnemyNightFleet } from '../main/ets/features/state/enemy_night_fleet';
import { BattleSimulator } from '../main/ets/features/simulator/core';

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

    it('normalizes legacy combined-night enemy damage onto the active escort', 0, () => {
      const raw: any = {
        api_data: {
          api_active_deck: [2, 1],
          api_f_nowhps: [60, 60, 60, 60, 60, 60],
          api_f_maxhps: [60, 60, 60, 60, 60, 60],
          api_f_nowhps_combined: [30, 30, 30, 30, 30, 30],
          api_f_maxhps_combined: [30, 30, 30, 30, 30, 30],
          api_e_nowhps: [40, 40, 40, 40, 40, 40],
          api_e_maxhps: [40, 40, 40, 40, 40, 40],
          api_ship_ke: [501, 502, 503, 504, 505, 506],
          api_ship_lv: [1, 1, 1, 1, 1, 1],
          api_hougeki: {
            // Legacy format: no api_at_eflag. 0..5 is friend, 6..11 is enemy.
            api_at_list: [6, 0],
            api_sp_list: [0, 0],
            api_df_list: [[1], [7]],
            api_damage: [[12], [5]],
            api_cl_list: [[1], [1]],
          },
        },
      };

      const segment = normalizeBattleSegment('api_req_combined_battle/midnight_battle', raw, { now: 2 });
      expect(segment !== null).assertTrue();
      if (!segment) return;

      expect(segment.phases[0].events.length).assertEqual(2);
      expect(segment.phases[0].events[0].attackerSide).assertEqual('enemy');
      expect(segment.phases[0].events[0].hits[0].target.fleet).assertEqual('escort');
      expect(segment.end.friend.escort?.now[1]).assertEqual(18);
      expect(segment.end.friend.main.now[1]).assertEqual(60);
      expect(segment.end.enemy.main.now[1]).assertEqual(35);

      // The current API may include side flags but retain flattened combined
      // indexes. This is the shape that previously dropped enemy hits on escort.
      raw.api_data.api_hougeki.api_at_eflag = [1, 0];
      raw.api_data.api_hougeki.api_at_list = [0, 6];
      raw.api_data.api_hougeki.api_df_list = [[7], [1]];
      const flagged = normalizeBattleSegment('api_req_combined_battle/midnight_battle', raw, { now: 3 });
      expect(flagged !== null).assertTrue();
      if (!flagged) return;
      expect(flagged.phases[0].events[0].attackerSide).assertEqual('enemy');
      expect(flagged.phases[0].events[0].hits[0].target.fleet).assertEqual('escort');
      expect(flagged.end.friend.escort?.now[1]).assertEqual(18);
      expect(flagged.end.enemy.main.now[1]).assertEqual(35);
    });

    it('uses opening-night packet HP and applies legacy enemy damage in the simulator', 0, () => {
      const staleShip = (id: number): any => ({
        api_ship_id: id,
        api_maxhp: 99,
        api_nowhp: 99,
        api_slot: [],
      });
      const simulator = new BattleSimulator({
        type: 1,
        main: [1, 2, 3, 4, 5, 6].map(staleShip),
        escort: [11, 12, 13, 14, 15, 16].map(staleShip),
      });

      simulator.simulate({
        _path: '/kcsapi/api_req_combined_battle/midnight_battle',
        api_active_deck: [2, 1],
        // This opening-night variant exposes only the active escort via plain HP keys.
        api_f_nowhps: [30, 30, 30, 30, 30, 30],
        api_f_maxhps: [30, 30, 30, 30, 30, 30],
        api_e_nowhps: [40, 40, 40, 40, 40, 40],
        api_e_maxhps: [40, 40, 40, 40, 40, 40],
        api_ship_ke: [501, 502, 503, 504, 505, 506],
        api_ship_lv: [1, 1, 1, 1, 1, 1],
        api_eSlot: [[], [], [], [], [], []],
        api_hougeki: {
          // Newer combined-night format: explicit side flags, while the
          // friendly escort still uses flattened indexes 6..11.
          api_at_eflag: [1, 0],
          api_at_list: [0, 6],
          api_sp_list: [0, 0],
          api_df_list: [[7], [1]],
          api_damage: [[12], [5]],
          api_cl_list: [[1], [1]],
        },
      });

      const prediction = simulator.getPrediction();
      expect(prediction.escortFleet?.[1]?.initHP).assertEqual(30);
      expect(prediction.escortFleet?.[1]?.nowHP).assertEqual(18);
      expect(prediction.mainFleet?.[1]?.initHP).assertEqual(99);
      expect(prediction.enemyFleet?.[1]?.nowHP).assertEqual(35);
    });
  });
}
