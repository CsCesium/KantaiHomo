import { AnyQuestEvt } from '../../../domain/events';
import { questsToRows } from '../../../domain/models/mapper/quest';
import { QuestListPage } from '../../../domain/models/struct/quest';
import { syncQuestPage, claimTrackedQuest, changeTrackedQuestState } from '../../quests/service';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class QuestPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyQuestEvt;
    switch (e.type) {
      case 'QUEST_LIST':
        await this.handleQuestList(e.payload, deps);
        break;
      case 'QUEST_CLAIMED':
        await this.handleQuestClaimed(e.payload.questId, deps);
        break;
      case 'QUEST_STATE_CHANGED':
        await this.handleQuestStateChanged(e.payload.questId, e.payload.state, e.payload.changedAt, deps);
        break;
    }
  }

  private async handleQuestList(page: QuestListPage, deps: PersistDeps): Promise<void> {
    await syncQuestPage(page);
    const payload = page.quests;

    if (!deps.repos?.quest) {
      console.warn('[persist][QUEST_LIST] repository not provided');
      return;
    }

    if (payload.length === 0) return;
    await deps.repos.quest.upsertBatch(questsToRows(payload));
  }

  private async handleQuestClaimed(questId: number, deps: PersistDeps): Promise<void> {
    await claimTrackedQuest(questId);

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
    await changeTrackedQuestState(questId, state, changedAt);
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
