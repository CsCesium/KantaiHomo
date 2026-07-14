import { describe, it, expect } from '@ohos/hypium';
import type { DeckSnapshot } from '../main/ets/features/state/type';
import { isFullStrikingForce } from '../main/ets/features/state/strikingForce';

function makeDeck(deckId: number, shipCount: number): DeckSnapshot {
  const shipUids: number[] = [];
  for (let i = 1; i <= shipCount; i++) {
    shipUids.push(i);
  }
  return {
    deckId,
    name: `fleet-${deckId}`,
    shipUids,
    expeditionReturnTime: null,
    expeditionMissionId: 0,
    capturedAt: 0,
  };
}

export default function strikingForceTest(): void {
  describe('strikingForce', () => {
    it('requires seven ships in fleet 3', 0, () => {
      expect(isFullStrikingForce([makeDeck(3, 6)])).assertFalse();
      expect(isFullStrikingForce([makeDeck(3, 7)])).assertTrue();
      expect(isFullStrikingForce([makeDeck(2, 7)])).assertFalse();
    });
  });
}
