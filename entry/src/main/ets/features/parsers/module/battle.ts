// ==================== URL 匹配模式 ====================
import {
  AnySortieEvt,
  SortieStartEvent,
  SortieNextEvent,
  AnyBattleEvt,
  BattleDayEvent,
  BattleNightEvent,
  BattleResultEvent,
  AnyBattleModuleEvt
} from "../../../domain/events";
import { BattleApiPath, normalizeBattleSegment, normalizeBattleResult } from "../../../domain/models";
import { normalizeSortieCell } from "../../../domain/models/normalizer/map";
import { predictBattle } from "../../../domain/service/battle_prediction";
import { ApiDump } from "../../../infra/web/types";
import { parseSvdata, parseFormBody, extractApiPath, matchAnyPattern } from "../../utils/common";
import { ParserCtx, mkEvt } from "./common";
import { getBattlePredictionService } from "../../simulator/battle_prediction_service";

const PATTERNS = {
  // 出击/地图
  MAP_START: /api_req_map\/start/,
  MAP_NEXT: /api_req_map\/next/,

  // 昼战
  DAY_BATTLE: /api_req_(sortie|combined_battle)\/(battle|airbattle|ld_airbattle|battle_water|each_battle|each_battle_water|ec_battle)/,

  // 夜战
  NIGHT_BATTLE: /api_req_(battle_midnight|combined_battle)\/(battle|sp_midnight|midnight_battle|ec_midnight_battle)/,

  // 战斗结果
  BATTLE_RESULT: /api_req_(sortie|combined_battle)\/battleresult/,

  // 演习
  PRACTICE_BATTLE: /api_req_practice\/battle/,
  PRACTICE_NIGHT: /api_req_practice\/midnight_battle/,
  PRACTICE_RESULT: /api_req_practice\/battle_result/,
};

const ALL_PATTERNS = Object.values(PATTERNS);

// ==================== 解析函数 ====================

/**
 * 解析 api_req_map/start (出击开始)
 */
function parseMapStart(dump: ApiDump, ctx: ParserCtx): AnySortieEvt[] {
  const raw = parseSvdata<any>(dump.responseText);
  if (!raw) return [];

  const params = parseFormBody(dump.requestBody);
  const deckId = params.getInt('api_deck_id', 1);

  const apiData = raw.api_data ?? raw;
  const normalized = normalizeSortieCell(apiData);

  // 舰队快照需要在 Handler 中从 Repository 获取
  const fleetSnapshot = {
    deckId,
    name: `Fleet ${deckId}`,
    ships: [],
    capturedAt: ctx.ts,
  };

  const event: SortieStartEvent = mkEvt(
    ctx,
    'SORTIE_START',
    ['SORTIE_START', normalized.mapAreaId, normalized.mapInfoNo, ctx.ts],
    {
      mapAreaId: normalized.mapAreaId,
      mapInfoNo: normalized.mapInfoNo,
      cellId: normalized.cellId,
      deckId,
      combinedType: 0, // 由 Handler 从内存状态获取
      fleetSnapshot,
    }
  );

  return [event];
}

/**
 * 解析 api_req_map/next (进入下一节点)
 */
function parseMapNext(dump: ApiDump, ctx: ParserCtx): AnySortieEvt[] {
  const raw = parseSvdata<any>(dump.responseText);
  if (!raw) return [];

  const apiData = raw.api_data ?? raw;
  const cell = normalizeSortieCell(apiData);

  const event: SortieNextEvent = mkEvt(
    ctx,
    'SORTIE_NEXT',
    ['SORTIE_NEXT', cell.mapAreaId, cell.mapInfoNo, cell.cellId, ctx.ts],
    { cell }
  );

  return [event];
}

/**
 * 解析昼战
 */
function parseDayBattle(dump: ApiDump, ctx: ParserCtx): AnyBattleEvt[] {
  const raw = parseSvdata<any>(dump.responseText);
  if (!raw) return [];

  const apiPath = extractApiPath(dump.url) as BattleApiPath;
  const isPractice = dump.url.includes('practice');
  const apiData = (raw.api_data ?? raw) as Record<string, unknown>;

  // 每场新的昼战重置模拟器，然后喂入首个数据包
  try {
    const svc = getBattlePredictionService();
    svc.reset();
    svc.onBattlePacket(apiPath, { ...apiData, _path: apiPath });
  } catch (_) { /* service 未初始化时静默跳过 */ }

  const segment = normalizeBattleSegment(apiPath, raw);
  if (!segment) return [];

  // 基础预测（HP 值来自 API，始终准确）
  const prediction = predictBattle(segment);

  // 用模拟器的精确等级覆盖预测等级
  try {
    const snap = getBattlePredictionService().getCurrentSnapshot();
    if (snap) {
      prediction.predictedRank = snap.rank;
    }
  } catch (_) { /* ignore */ }

  const event: BattleDayEvent = mkEvt(
    ctx,
    'BATTLE_DAY',
    ['BATTLE_DAY', apiPath, ctx.ts],
    {
      apiPath,
      segment,
      prediction,
      isPractice,
    }
  );

  return [event];
}

/**
 * 解析夜战
 */
function parseNightBattle(dump: ApiDump, ctx: ParserCtx): AnyBattleEvt[] {
  const raw = parseSvdata<any>(dump.responseText);
  if (!raw) return [];

  const apiPath = extractApiPath(dump.url) as BattleApiPath;
  const isPractice = dump.url.includes('practice');
  const apiData = (raw.api_data ?? raw) as Record<string, unknown>;

  // 夜战累计到当前模拟器（不 reset）
  try {
    getBattlePredictionService().onBattlePacket(apiPath, { ...apiData, _path: apiPath });
  } catch (_) { /* ignore */ }

  const segment = normalizeBattleSegment(apiPath, raw);
  if (!segment) return [];

  const prediction = predictBattle(segment);

  // 覆盖等级（夜战后等级可能与昼战不同）
  try {
    const snap = getBattlePredictionService().getCurrentSnapshot();
    if (snap) {
      prediction.predictedRank = snap.rank;
    }
  } catch (_) { /* ignore */ }

  const event: BattleNightEvent = mkEvt(
    ctx,
    'BATTLE_NIGHT',
    ['BATTLE_NIGHT', apiPath, ctx.ts],
    {
      apiPath,
      segment,
      prediction,
      isPractice,
    }
  );

  return [event];
}

/**
 * 解析战斗结果
 */
function parseBattleResultDump(dump: ApiDump, ctx: ParserCtx): AnyBattleEvt[] {
  const raw = parseSvdata<any>(dump.responseText);
  if (!raw) return [];

  const apiPath = extractApiPath(dump.url);
  const isPractice = dump.url.includes('practice');
  const apiData = (raw.api_data ?? raw) as Record<string, unknown>;

  // 将实际结果喂给模拟器（使其发布最终快照）
  try {
    getBattlePredictionService().onBattlePacket(apiPath, { ...apiData, _path: apiPath });
  } catch (_) { /* ignore */ }

  const result = normalizeBattleResult(raw);

  const event: BattleResultEvent = mkEvt(
    ctx,
    'BATTLE_RESULT',
    ['BATTLE_RESULT', apiPath, ctx.ts],
    {
      apiPath,
      isPractice,
      result,
    }
  );

  return [event];
}

// ==================== 主入口 ====================

/**
 * 解析战斗相关 API dump
 *
 */
export function parseBattle(dump: ApiDump): AnyBattleModuleEvt[] | null {
  const url = dump.url;

  // 检查是否匹配任何战斗相关 URL
  if (!matchAnyPattern(url, ALL_PATTERNS)) {
    return null;
  }

  const ctx: ParserCtx = {
    ts: Date.now(),
    url: dump.url,
    endpoint: extractApiPath(dump.url),
    requestBody: dump.requestBody,
    responseText: dump.responseText,
  };

  if (PATTERNS.MAP_START.test(url)) {
    return parseMapStart(dump, ctx);
  }

  if (PATTERNS.MAP_NEXT.test(url)) {
    return parseMapNext(dump, ctx);
  }

  if (PATTERNS.DAY_BATTLE.test(url) || PATTERNS.PRACTICE_BATTLE.test(url)) {
    return parseDayBattle(dump, ctx);
  }

  if (PATTERNS.NIGHT_BATTLE.test(url) || PATTERNS.PRACTICE_NIGHT.test(url)) {
    return parseNightBattle(dump, ctx);
  }

  if (PATTERNS.BATTLE_RESULT.test(url) || PATTERNS.PRACTICE_RESULT.test(url)) {
    return parseBattleResultDump(dump, ctx);
  }

  return null;
}

// 兼容
export const parseBattleDump = parseBattle;

/**
 * 检查 URL 是否匹配战斗相关 API
 */
export function isBattleUrl(url: string): boolean {
  return matchAnyPattern(url, ALL_PATTERNS);
}
