import { predictBattle, enrichPredictionWithShipInfo } from ".";
import {
  SortieContext,
  BattleApiPath,
  ApiMaybeEnvelope,
  BattleContext,
  BattlePrediction,
  normalizeBattleSegment,
  createBattleContext,
  mergeBattleSegments,
  BattleRecord,
  normalizeBattleResult,
  generateBattleId,
  NormalizedBattleResult,
  BattleType,
  EnemyFleetInfo,
  BattleSegment,
  ApiBattleResultRaw
} from "../models";
/**
 * Battle Service - 战斗处理服务
 * 处理战斗 API 数据，生成预测和记录
 */

// ==================== 战斗处理 ====================

/**
 * 处理昼战 API
 */
export function processDayBattle(
  context: SortieContext,
  apiPath: BattleApiPath,
  rawData: ApiMaybeEnvelope<any>
): { battleContext: BattleContext; prediction: BattlePrediction } | null {
  if (!context.currentCell) return null;

  const segment = normalizeBattleSegment(apiPath, rawData);
  if (!segment) return null;

  // 创建或获取战斗上下文
  let battleContext = context.pendingBattle;
  if (!battleContext) {
    battleContext = createBattleContext(
      context.currentCell,
      isPracticeBattle(apiPath),
      isCombinedBattle(apiPath)
    );
  }

  battleContext.daySegment = segment;
  battleContext.merged = segment;

  // 提取敌方信息
  battleContext.enemyFleet = extractEnemyFleet(rawData);
  battleContext.enemyFleetEscort = extractEnemyFleetEscort(rawData);

  // 计算预测
  const prediction = predictBattle(segment);

  // 用舰船信息填充预测
  const enrichedPrediction = enrichPredictionWithShipInfo(
    prediction,
    context.fleetSnapshot.ships.map(s => ({ uid: s.uid, name: s.name })),
    context.fleetSnapshotEscort?.ships.map(s => ({ uid: s.uid, name: s.name }))
  );

  battleContext.prediction = enrichedPrediction;

  return { battleContext, prediction: enrichedPrediction };
}

/**
 * 处理夜战 API
 */
export function processNightBattle(
  context: SortieContext,
  apiPath: BattleApiPath,
  rawData: ApiMaybeEnvelope<any>
): { battleContext: BattleContext; prediction: BattlePrediction } | null {
  const segment = normalizeBattleSegment(apiPath, rawData);
  if (!segment) return null;

  let battleContext = context.pendingBattle;
  if (!battleContext) {
    // 没有昼战直接进夜战的情况 (如开幕夜战)
    if (!context.currentCell) return null;
    battleContext = createBattleContext(
      context.currentCell,
      isPracticeBattle(apiPath),
      isCombinedBattle(apiPath)
    );
  }

  battleContext.nightSegment = segment;

  // 合并昼夜战
  if (battleContext.daySegment) {
    battleContext.merged = mergeBattleSegments(battleContext.daySegment, segment);
  } else {
    battleContext.merged = segment;
  }

  // 计算预测
  const prediction = predictBattle(battleContext.merged);

  // 用舰船信息填充预测
  const enrichedPrediction = enrichPredictionWithShipInfo(
    prediction,
    context.fleetSnapshot.ships.map(s => ({ uid: s.uid, name: s.name })),
    context.fleetSnapshotEscort?.ships.map(s => ({ uid: s.uid, name: s.name }))
  );

  battleContext.prediction = enrichedPrediction;

  return { battleContext, prediction: enrichedPrediction };
}

/**
 * 处理战斗结果 API，生成完整的战斗记录
 */
export function processBattleResult(
  context: SortieContext,
  rawData: ApiMaybeEnvelope<ApiBattleResultRaw>
): BattleRecord | null {
  const battleContext = context.pendingBattle;
  if (!battleContext || !battleContext.merged) {
    return null;
  }

  const now = Date.now();
  const segment = battleContext.merged;
  
  // 使用 normalizer 处理结果数据
  const result = normalizeBattleResult(rawData, now);
  
  const record: BattleRecord = {
    id: generateBattleId(),
    sortieId: context.sortieId,

    // 点位
    mapAreaId: context.mapAreaId,
    mapInfoNo: context.mapInfoNo,
    cellId: battleContext.cell.cellId,
    cellEventId: battleContext.cell.eventId,
    isBoss: battleContext.cell.isBoss ?? false,

    // 类型
    battleType: determineBattleType(context, battleContext),
    isPractice: battleContext.isPractice,

    // 阵型
    friendFormation: segment.meta.formation?.friend,
    enemyFormation: segment.meta.formation?.enemy,
    engagement: segment.meta.formation?.engagement,

    // 制空 (从 kouku 阶段提取)
    airState: extractAirState(segment),

    // 舰队快照
    friendFleet: context.fleetSnapshot,
    friendFleetEscort: context.fleetSnapshotEscort,

    // 敌方信息
    enemyFleet: battleContext.enemyFleet ?? {
      shipIds: segment.enemy?.mainKe ?? [],
      levels: segment.enemy?.mainLv ?? [],
      hpNow: segment.end.enemy.main.now,
      hpMax: segment.end.enemy.main.max,
    },
    enemyFleetEscort: battleContext.enemyFleetEscort,

    // 基地航空队
    airBases: context.airBases,

    // HP
    hpStart: segment.start,
    hpEnd: segment.end,
    
    // 结果
    rank: result.rank,
    mvp: result.mvp.main,
    mvpCombined: result.mvp.combined,
    
    // 掉落
    dropShipId: result.drop?.shipId,
    dropShipName: result.drop?.shipName,
    dropItemId: result.drop?.itemId,
    
    // 经验
    baseExp: result.exp.base,
    
    // 时间
    startedAt: battleContext.startedAt,
    endedAt: now,
  };
  
  return record;
}

/**
 * 处理战斗结果并返回标准化数据（用于需要更多信息的场景）
 */
export function processBattleResultFull(
  context: SortieContext,
  rawData: ApiMaybeEnvelope<ApiBattleResultRaw>
): { record: BattleRecord; result: NormalizedBattleResult } | null {
  const battleContext = context.pendingBattle;
  if (!battleContext || !battleContext.merged) {
    return null;
  }
  
  const result = normalizeBattleResult(rawData);
  const record = processBattleResult(context, rawData);
  
  if (!record) return null;
  
  return { record, result };
}

// ==================== 舰队状态预计算 ====================

export interface DeckHpChange {
  shipUid: number;
  hpBefore: number;
  hpAfter: number;
  hpMax: number;
}

export interface DeckAmmoFuelChange {
  shipUid: number;
  fuelBefore: number;
  fuelAfter: number;
  ammoBefore: number;
  ammoAfter: number;
}

/**
 * 预计算战斗后的 HP 变化
 */
export function predictDeckHpChanges(
  context: SortieContext,
  prediction: BattlePrediction
): DeckHpChange[] {
  const changes: DeckHpChange[] = [];

  // 主力舰队
  for (let i = 0; i < prediction.friendMain.length && i < context.fleetSnapshot.ships.length; i++) {
    const pred = prediction.friendMain[i];
    const ship = context.fleetSnapshot.ships[i];
    if (pred && ship) {
      changes.push({
        shipUid: ship.uid,
        hpBefore: pred.hpBefore,
        hpAfter: pred.hpAfter,
        hpMax: pred.hpMax,
      });
    }
  }

  // 护卫舰队
  if (prediction.friendEscort && context.fleetSnapshotEscort) {
    for (let i = 0; i < prediction.friendEscort.length && i < context.fleetSnapshotEscort.ships.length; i++) {
      const pred = prediction.friendEscort[i];
      const ship = context.fleetSnapshotEscort.ships[i];
      if (pred && ship) {
        changes.push({
          shipUid: ship.uid,
          hpBefore: pred.hpBefore,
          hpAfter: pred.hpAfter,
          hpMax: pred.hpMax,
        });
      }
    }
  }

  return changes;
}

/**
 * 估算战斗后的油弹消耗
 * 昼战: 燃料20%, 弹药20%
 * 夜战: 燃料10%, 弹药10%
 * 开幕夜战: 燃料10%, 弹药10%
 */
export function estimateAmmoFuelConsumption(
  context: SortieContext,
  battleContext: BattleContext
): DeckAmmoFuelChange[] {
  const hasDayBattle = !!battleContext.daySegment;
  const hasNightBattle = !!battleContext.nightSegment;

  // 消耗比例
  let fuelRate = 0;
  let ammoRate = 0;

  if (hasDayBattle) {
    fuelRate += 0.2;
    ammoRate += 0.2;
  }
  if (hasNightBattle) {
    fuelRate += 0.1;
    ammoRate += 0.1;
  }

  const changes: DeckAmmoFuelChange[] = [];

  // 主力舰队
  for (const ship of context.fleetSnapshot.ships) {
    const fuelBefore = ship.fuel;
    const ammoBefore = ship.ammo;
    const fuelMax = ship.fuelMax || 100;
    const ammoMax = ship.ammoMax || 100;

    // 消耗基于最大值的比例
    const fuelConsume = Math.floor(fuelMax * fuelRate);
    const ammoConsume = Math.floor(ammoMax * ammoRate);

    changes.push({
      shipUid: ship.uid,
      fuelBefore,
      fuelAfter: Math.max(0, fuelBefore - fuelConsume),
      ammoBefore,
      ammoAfter: Math.max(0, ammoBefore - ammoConsume),
    });
  }

  // 护卫舰队
  if (context.fleetSnapshotEscort) {
    for (const ship of context.fleetSnapshotEscort.ships) {
      const fuelBefore = ship.fuel;
      const ammoBefore = ship.ammo;
      const fuelMax = ship.fuelMax || 100;
      const ammoMax = ship.ammoMax || 100;

      const fuelConsume = Math.floor(fuelMax * fuelRate);
      const ammoConsume = Math.floor(ammoMax * ammoRate);

      changes.push({
        shipUid: ship.uid,
        fuelBefore,
        fuelAfter: Math.max(0, fuelBefore - fuelConsume),
        ammoBefore,
        ammoAfter: Math.max(0, ammoBefore - ammoConsume),
      });
    }
  }

  return changes;
}

// ==================== 辅助函数 ====================

function isPracticeBattle(apiPath: string): boolean {
  return apiPath.startsWith('api_req_practice/');
}

function isCombinedBattle(apiPath: string): boolean {
  return apiPath.startsWith('api_req_combined_battle/');
}

function determineBattleType(context: SortieContext, battleContext: BattleContext): BattleType {
  if (battleContext.isPractice) return 'practice';
  if (battleContext.isAirRaid) return 'air_raid';

  switch (context.combinedType) {
    case 1: return 'combined_ctf';
    case 2: return 'combined_stf';
    case 3: return 'combined_tcf';
    default: return 'normal';
  }
}

function extractEnemyFleet(rawData: any): EnemyFleetInfo | undefined {
  const data = rawData?.api_data ?? rawData;
  if (!data) return undefined;

  const shipIds = normalizeArray(data.api_ship_ke);
  const levels = normalizeArray(data.api_ship_lv);
  const slots = data.api_eSlot;
  const params = data.api_eParam;
  const hpNow = normalizeArray(data.api_e_nowhps);
  const hpMax = normalizeArray(data.api_e_maxhps);

  if (!shipIds.length) return undefined;

  return { shipIds, levels, slots, params, hpNow, hpMax };
}

function extractEnemyFleetEscort(rawData: any): EnemyFleetInfo | undefined {
  const data = rawData?.api_data ?? rawData;
  if (!data) return undefined;

  const shipIds = normalizeArray(data.api_ship_ke_combined);
  const levels = normalizeArray(data.api_ship_lv_combined);
  const slots = data.api_eSlot_combined;
  const params = data.api_eParam_combined;
  const hpNow = normalizeArray(data.api_e_nowhps_combined);
  const hpMax = normalizeArray(data.api_e_maxhps_combined);

  if (!shipIds.length) return undefined;

  return { shipIds, levels, slots, params, hpNow, hpMax };
}

function extractAirState(segment: BattleSegment): number | undefined {
  // 从 air 阶段的 rawKey 或 events 中提取
  // 这需要在 normalizer 中保存更多信息
  // 暂时返回 undefined
  return undefined;
}

function normalizeArray(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  const nums = arr.map((v: any) => (typeof v === 'number' ? v : 0));
  // 跳过 dummy head
  if (nums.length === 7 && (nums[0] === 0 || nums[0] === -1)) return nums.slice(1);
  if (nums.length === 13 && (nums[0] === 0 || nums[0] === -1)) return nums.slice(1);
  return nums;
}
