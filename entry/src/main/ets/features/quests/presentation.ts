import type { QuestSnapshot } from '../state/type';
import type { QuestProgressView } from './types';

/** Highlight server-confirmed completion or all locally tracked goals being satisfied. */
export function claimableQuestCount(quests: ReadonlyArray<QuestSnapshot>,
  progressForQuest: (id: number) => QuestProgressView | null): number {
  return quests.filter(quest => {
    if (quest.state === 3) return true;
    if (quest.state !== 2) return false;
    const progress = progressForQuest(quest.questId);
    return progress !== null && progress.items.length > 0 && progress.items.every(item => item.satisfied);
  }).length;
}
