import type { QuestSnapshot } from '../state/type';

/** Only the server's completed state means a reward can be claimed. */
export function claimableQuestCount(quests: ReadonlyArray<QuestSnapshot>): number {
  return quests.filter(quest => quest.state === 3).length;
}
