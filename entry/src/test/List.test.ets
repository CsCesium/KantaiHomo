import localUnitTest from './LocalUnit.test';
import mapEventTest from './MapEvent.test';
import strikingForceTest from './StrikingForce.test';
import damageTest from './Damage.test';
import battleNormalizerTest from './BattleNormalizer.test';
import fighterPowerTest from './FighterPower.test';

export default function testsuite() {
  localUnitTest();
  mapEventTest();
  strikingForceTest();
  damageTest();
  battleNormalizerTest();
  fighterPowerTest();
}
