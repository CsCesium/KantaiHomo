import localUnitTest from './LocalUnit.test';
import mapEventTest from './MapEvent.test';
import strikingForceTest from './StrikingForce.test';
import damageTest from './Damage.test';

export default function testsuite() {
  localUnitTest();
  mapEventTest();
  strikingForceTest();
  damageTest();
}
