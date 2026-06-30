import localUnitTest from './LocalUnit.test';
import mapEventTest from './MapEvent.test';

export default function testsuite() {
  localUnitTest();
  mapEventTest();
}
