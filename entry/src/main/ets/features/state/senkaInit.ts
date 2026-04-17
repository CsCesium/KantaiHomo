import { kvGetString } from '../../infra/storage/kv';
import { initDailySenka, initRanking } from './game_state';
import { RankingSnapshot } from './type';

const KV_RANKING_KEY = 'senka.ranking.v1';
const KV_DAILY_KEY = 'senka.daily.v1';

/** 获取 JST 日期字符串 (YYYY-MM-DD) */
function getJSTDateString(): string {
  const jstMs = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(jstMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 从 KV 加载战果跟踪数据，在应用启动时调用一次。
 * 恢复当日经验起点（同日有效）和战绩快照。
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

/**
 * 将当日经验起点保存至 KV（在首次初始化时或跨日重置后调用）。
 */
export async function saveDailyToKV(exp: number, time: number): Promise<void> {
  try {
    const date = getJSTDateString();
    const { kvSet } = await import('../../infra/storage/kv');
    await kvSet(KV_DAILY_KEY, JSON.stringify({ exp, time, date }));
  } catch (_e) {}
}
