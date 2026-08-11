import { describe, expect, it } from '@ohos/hypium';
import { shouldBlock } from '../main/ets/infra/web/interceptors/Interceptor';

export default function interceptorTest(): void {
  describe('request interceptor', () => {
    it('allows the DMM cashier request chain before generic filters', 0, () => {
      expect(shouldBlock(
        'https://gw.dmmapis.com/d-af2/v1/api.js?service_name=cashier',
      )).assertFalse();

      // Cashier follow-up endpoints must not be mistaken for tracking collection URLs.
      expect(shouldBlock(
        'https://gw.dmmapis.com/collect?service_name=cashier',
      )).assertFalse();
    });

    it('keeps lookalike and advertising hosts blocked', 0, () => {
      expect(shouldBlock(
        'https://dmmapis.com.example.com/collect?service_name=cashier',
      )).assertTrue();
      expect(shouldBlock('https://pagead2.googlesyndication.com/pagead/js/ads.js')).assertTrue();
    });
  });
}
