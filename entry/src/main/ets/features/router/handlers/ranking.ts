import { AnyRankingEvt, RankingSnapshotEvent } from '../../../domain/events/ranking';
import { RankingSnapshot } from '../../state/type';
import { getAdmiral, updateRanking } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

const KV_RANKING_KEY = 'senka.ranking.v1';

class RankingPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyRankingEvt;
    if (e.type === 'RANKING_SNAPSHOT') {
      await this.handleSnapshot(e as RankingSnapshotEvent, deps);
    }
  }

  private async handleSnapshot(ev: RankingSnapshotEvent, deps: PersistDeps): Promise<void> {
    const admiral = getAdmiral();
    if (!admiral) return;

    const myId = String(admiral.memberId);
    const myNick = admiral.nickname;

    // 从列表中查找当前提督的条目（按 memberId 或昵称匹配）
    const myEntry = ev.payload.entries.find(
      e => String(e.memberId) === myId || e.nickname === myNick
    );
    if (!myEntry) return;

    const snapshot: RankingSnapshot = {
      rank: myEntry.rank,
      senka: myEntry.senka,
      exp: admiral.experience,
      memberId: myId,
      capturedAt: ev.timestamp,
    };

    updateRanking(snapshot);

    if (deps.kvSet) {
      await deps.kvSet(KV_RANKING_KEY, JSON.stringify(snapshot));
    }
  }
}

const handler = new RankingPersistHandler();
registerHandler('RANKING_SNAPSHOT', handler);
