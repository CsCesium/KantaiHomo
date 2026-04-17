import { kvGetString } from '../../infra/storage/kv';
import { initDailySenka, initRanking } from './game_state';
import { RankingSnapshot } from './type';

const KV_RANKING_KEY = 'senka.ranking.v1';
const KV_DAILY_KEY = 'senka.daily.v1';

/**
 * 从 KV 加载战果跟踪数据，在应用启动时调用一次。
 * 恢复当前统计周期经验起点和战绩快照。
 */
export async function loadSenkaFromKV(): Promise<void> {
  await Promise.all([loadDailyFromKV(), loadRankingFromKV()]);
}

async function loadDailyFromKV(): Promise<void> {
  try {
    const raw = await kvGetString(KV_DAILY_KEY, '');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { exp: number; time: number; date: string };
    if (typeof parsed.exp === 'number' && typeof parsed.time === 'number' && typeof parsed.date === 'string') {
      // date 字段存的是 CST 统计周期 ID（由 game_state 内部验证是否匹配当前周期）
      initDailySenka(parsed.exp, parsed.time, parsed.date);
    }
  } catch (_e) {}
}

async function loadRankingFromKV(): Promise<void> {
  try {
    const raw = await kvGetString(KV_RANKING_KEY, '');
    if (!raw) return;
    const parsed = JSON.parse(raw) as RankingSnapshot;
    if (typeof parsed.senka === 'number' && typeof parsed.rank === 'number') {
      initRanking(parsed);
    }
  } catch (_e) {}
}
