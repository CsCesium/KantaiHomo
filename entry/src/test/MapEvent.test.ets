import { describe, it, expect } from '@ohos/hypium';
import { getFullEventDesc, isBattleEventId } from '../main/ets/domain/models/enums/map';

export default function mapEventTest() {
  describe('mapEvent', () => {
    it('distinguishes battle kinds', 0, () => {
      expect(getFullEventDesc(4, 1)).assertEqual('战斗(昼战)');
      expect(getFullEventDesc(4, 2)).assertEqual('战斗(夜战)');
      expect(getFullEventDesc(4, 3)).assertEqual('战斗(夜战→昼战)');
      expect(getFullEventDesc(4, 4)).assertEqual('战斗(航空战)');
      expect(getFullEventDesc(4, 5)).assertEqual('战斗(联合舰队战)');
      expect(getFullEventDesc(4, 6)).assertEqual('战斗(长距离空袭战)');
    });

    it('distinguishes route selection and aerial reconnaissance', 0, () => {
      expect(getFullEventDesc(6, 2)).assertEqual('能动分歧');
      expect(getFullEventDesc(14, 0)).assertEqual('能动分歧');
      expect(getFullEventDesc(7, 0)).assertEqual('航空侦察');
      expect(getFullEventDesc(7, 4)).assertEqual('航空战');
    });

    it('recognizes direct combat node ids', 0, () => {
      expect(getFullEventDesc(10, 0)).assertEqual('空袭战');
      expect(getFullEventDesc(11, 0)).assertEqual('长距离空袭战');
      expect(getFullEventDesc(12, 0)).assertEqual('雷达射击');
      expect(getFullEventDesc(13, 0)).assertEqual('泊地修理');
      expect(isBattleEventId(7, 0)).assertFalse();
      expect(isBattleEventId(7, 4)).assertTrue();
      expect(isBattleEventId(10, 0)).assertTrue();
      expect(isBattleEventId(11, 0)).assertTrue();
      expect(isBattleEventId(12, 0)).assertTrue();
      expect(isBattleEventId(14, 0)).assertFalse();
    });
  });
}
