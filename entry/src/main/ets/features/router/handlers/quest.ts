import { AnyQuestEvt } from '../../../domain/events';
import { questsToRows } from '../../../domain/models/mapper/quest';
import { Quest } from '../../../domain/models/struct/quest';
import { updateQuests } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class QuestPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyQuestEvt;
    switch (e.type) {
      case 'QUEST_LIST':
        await this.handleQuestList(e.payload.quests, deps);
        break;
    }
  }

  private async handleQuestList(payload: Quest[], deps: PersistDeps): Promise<void> {
    updateQuests(payload);

    if (!deps.repos?.quest) {
      console.warn('[persist][QUEST_LIST] repository not provided');
      return;
    }

    if (payload.length === 0) return;
    await deps.repos.quest.upsertBatch(questsToRows(payload));
  }
}

const handler = new QuestPersistHandler();
registerHandler('QUEST_LIST', handler);
