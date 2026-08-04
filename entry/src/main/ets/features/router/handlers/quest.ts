import { AnyQuestEvt } from '../../../domain/events';
import { questsToRows } from '../../../domain/models/mapper/quest';
import { Quest } from '../../../domain/models/struct/quest';
import { QuestState } from '../../../domain/models/enums/quest';
import { removeQuest, setQuestState, updateQuests } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class QuestPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyQuestEvt;
    switch (e.type) {
      case 'QUEST_LIST':
        await this.handleQuestList(e.payload.quests, e.payload.tabId === 0, deps);
        break;
      case 'QUEST_CLAIMED':
        await this.handleQuestClaimed(e.payload.questId, deps);
        break;
      case 'QUEST_STATE_CHANGED':
        await this.handleQuestStateChanged(e.payload.questId, e.payload.state, e.payload.changedAt, deps);
        break;
    }
  }

  private async handleQuestList(payload: Quest[], replaceAll: boolean, deps: PersistDeps): Promise<void> {
    updateQuests(payload, replaceAll);

    if (!deps.repos?.quest) {
      console.warn('[persist][QUEST_LIST] repository not provided');
      return;
    }

    if (payload.length === 0) return;
    await deps.repos.quest.upsertBatch(questsToRows(payload));
  }

  private async handleQuestClaimed(questId: number, deps: PersistDeps): Promise<void> {
    removeQuest(questId);

    if (!deps.repos?.quest) {
      console.warn('[persist][QUEST_CLAIMED] repository not provided');
      return;
    }

    await deps.repos.quest.delete(questId);
  }

  private async handleQuestStateChanged(
    questId: number,
    state: 1 | 2,
    changedAt: number,
    deps: PersistDeps
  ): Promise<void> {
    setQuestState(questId, state as QuestState);
    if (!deps.repos?.quest) return;

    const row = await deps.repos.quest.get(questId);
    if (!row) return;
    await deps.repos.quest.upsertBatch([{ ...row, state, updatedAt: changedAt }]);
  }
}

const handler = new QuestPersistHandler();
registerHandler('QUEST_LIST', handler);
registerHandler('QUEST_CLAIMED', handler);
registerHandler('QUEST_STATE_CHANGED', handler);
