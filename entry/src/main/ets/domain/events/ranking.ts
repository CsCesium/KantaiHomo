import { PayloadEvent } from "./type"

export interface RankingEntryList {
  entries: Array<{
    memberId: string;
    rank: number;
    senka: number;
    nickname: string;
  }>;
}

export type RankingSnapshotEvent = PayloadEvent<'RANKING_SNAPSHOT', RankingEntryList>

export type AnyRankingEvt = RankingSnapshotEvent
