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
import type { BattleSegment } from "../../../domain/models/struct/battle";
import { normalizeSortieCell } from "../../../domain/models/normalizer/map";
import { getSortieContext } from "../../../domain/service";
import type { BattlePrediction, ShipPrediction } from "../../../domain/models/struct/battle_record";
import { ApiDump } from "../../../infra/web/types";
import { parseSvdata, parseFormBody, extractApiPath, matchAnyPattern } from "../../utils/common";
import { ParserCtx, mkEvt } from "./common";
import { getBattlePredictionService } from "../../simulator/battle_prediction_service";
import type { BattlePredictionSnapshot, ShipHPSnapshot } from "../../simulator/battle_prediction_service";

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

// ==================== 模拟器结果转换 ====================

/**
 * 将模拟器快照转换为领域层 BattlePrediction。
 * friendShips / friendEscortShips 来自出击上下文的舰队快照，用于填充 uid/name。
 */
function simSnapshotToDomainPrediction(
  snap: BattlePredictionSnapshot,
  friendShips?: { uid: number; name: string }[],
  friendEscortShips?: { uid: number; name: string }[],
): BattlePrediction {
  function toShipPred(
    s: ShipHPSnapshot,
    ships: { uid: number; name: string }[] | undefined,
    posOffset: number,
  ): ShipPrediction {
    const hpAfter = Math.max(0, s.nowHP);
    const damageReceived = Math.max(0, s.initHP - hpAfter);
    const idx = s.pos - posOffset;
    return {
      uid:            ships?.[idx]?.uid  ?? 0,
      name:           ships?.[idx]?.name ?? '',
      hpBefore:       s.initHP,
      hpAfter,
      hpMax:          s.maxHP,
      damageReceived,
      damageTaken:    s.maxHP > 0 ? Math.round((1 - hpAfter / s.maxHP) * 100) : 0,
      isSunk:         s.isSunk,
      isTaiha:        s.isTaiha,
      isChuuha:       s.isChuuha,
      isShouha:       s.isShouha,
    };
  }

  const friendMain   = snap.mainFleet.map(s => toShipPred(s, friendShips, 0));
  const friendEscort = snap.escortFleet.length > 0
    ? snap.escortFleet.map(s => toShipPred(s, friendEscortShips, 6))
    : undefined;
  const enemyMain    = snap.enemyFleet.map(s => toShipPred(s, undefined, 0));
  const enemyEscort  = snap.enemyEscort.length > 0
    ? snap.enemyEscort.map(s => toShipPred(s, undefined, 0))
    : undefined;

  const friendSunkCount  = friendMain.filter(s => s.isSunk).length  + (friendEscort?.filter(s => s.isSunk).length  ?? 0);
  const friendTaihaCount = friendMain.filter(s => s.isTaiha).length + (friendEscort?.filter(s => s.isTaiha).length ?? 0);
  const enemySunkCount   = enemyMain.filter(s => s.isSunk).length   + (enemyEscort?.filter(s => s.isSunk).length   ?? 0);

  return {
    friendMain,
    friendEscort,
    enemyMain,
    enemyEscort,
    predictedRank:  snap.rank,
    friendSunkCount,
    friendTaihaCount,
    enemySunkCount,
    hasTaihaFriend: friendTaihaCount > 0,
    hasSunkFriend:  friendSunkCount  > 0,
    calculatedAt:   snap.updatedAt,
  };
}

/**
 * 模拟器未就绪时的占位预测：使用战斗开始前的 HP，不计算伤害。
 * 仅作为数据缺失时的安全占位，不应被 UI 当作真实结算结果展示。
 */
function buildFallbackPrediction(segment: BattleSegment): BattlePrediction {
  function fromFleet(fleet: { now: number[]; max: number[] } | undefined): ShipPrediction[] {
    if (!fleet) return [];
    return fleet.now
      .map((hp, i) => ({ hp, max: fleet.max[i] ?? 0 }))
      .filter(({ max }) => max > 0)
      .map(({ hp, max }) => ({
        uid: 0, name: '',
        hpBefore: hp, hpAfter: hp, hpMax: max,
        damageReceived: 0, damageTaken: 0,
        isSunk: false, isTaiha: false, isChuuha: false, isShouha: false,
      }));
  }
  return {
    friendMain:      fromFleet(segment.start.friend.main),
    friendEscort:    segment.start.friend.escort ? fromFleet(segment.start.friend.escort) : undefined,
    enemyMain:       fromFleet(segment.start.enemy.main),
    enemyEscort:     segment.start.enemy.escort  ? fromFleet(segment.start.enemy.escort)  : undefined,
    predictedRank:   'D',
    friendSunkCount: 0, friendTaihaCount: 0, enemySunkCount: 0,
    hasTaihaFriend:  false, hasSunkFriend: false,
    calculatedAt:    Date.now(),
  };
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
  // 注意：simulator 内部路径格式为 '/kcsapi/...'，而 extractApiPath 返回短格式
  const simPath = '/kcsapi/' + apiPath;
  try {
    const svc = getBattlePredictionService();
    svc.reset();
    svc.onBattlePacket(simPath, { ...apiData, _path: simPath });
  } catch (_) { /* service 未初始化时静默跳过 */ }

  const segment = normalizeBattleSegment(apiPath, raw);
  if (!segment) return [];

  // 优先使用模拟器结果（含精确敌我 HP）；模拟器未就绪时使用开战前 HP 占位
  let prediction: BattlePrediction;
  try {
    const snap = getBattlePredictionService().getCurrentSnapshot();
    if (snap) {
      const context = getSortieContext();
      prediction = simSnapshotToDomainPrediction(
        snap,
        context?.fleetSnapshot?.ships?.map(s => ({ uid: s.uid, name: s.name })),
        context?.fleetSnapshotEscort?.ships?.map(s => ({ uid: s.uid, name: s.name })),
      );
    } else {
      prediction = buildFallbackPrediction(segment);
    }
  } catch (_) {
    prediction = buildFallbackPrediction(segment);
  }

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
  const simPath = '/kcsapi/' + apiPath;
  try {
    getBattlePredictionService().onBattlePacket(simPath, { ...apiData, _path: simPath });
  } catch (_) { /* ignore */ }

  const segment = normalizeBattleSegment(apiPath, raw);
  if (!segment) return [];

  let prediction: BattlePrediction;
  try {
    const snap = getBattlePredictionService().getCurrentSnapshot();
    if (snap) {
      const context = getSortieContext();
      prediction = simSnapshotToDomainPrediction(
        snap,
        context?.fleetSnapshot?.ships?.map(s => ({ uid: s.uid, name: s.name })),
        context?.fleetSnapshotEscort?.ships?.map(s => ({ uid: s.uid, name: s.name })),
      );
    } else {
      prediction = buildFallbackPrediction(segment);
    }
  } catch (_) {
    prediction = buildFallbackPrediction(segment);
  }

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
  const simPath = '/kcsapi/' + apiPath;
  try {
    getBattlePredictionService().onBattlePacket(simPath, { ...apiData, _path: simPath });
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
