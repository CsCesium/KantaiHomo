import { AnyExpEvt } from '../../../domain/events';
import { MissionStart, ExpeditionProgress, ExpeditionSlotState, MissionResult, MissionCatalogItem } from '../../../domain/models';
import { ExpeditionRow, ExpeditionResultRow, MissionRow } from '../../../infra/storage/types';
import { i32, i64 } from '../../../infra/utils/num';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';
import { cacheMissionNames } from '../../../features/alerts/module/missionCache';
import { triggerExpeditionChanged } from '../../../features/alerts/module/expeditionTrigger';

class ExpeditionHandler implements Handler{
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyExpEvt;

    if (!deps.repos?.expedition) {
      console.warn('[persist][EXPEDITION] repository not provided');
      return;
    }

    const ts = ev.timestamp ?? Date.now();

    switch (e.type) {
      case 'EXPEDITION_START':
        await this.handleStart(e.payload, ts, deps);
        break;
      case 'EXPEDITION_UPDATE':
        await this.handleUpdate(e.payload, ts, deps);
        break;
      case 'EXPEDITION_RESULT':
        await this.handleResult(e.payload, ts, deps);
        break;
      case 'EXPEDITION_CATALOG':
        await this.handleCatalog(e.payload as MissionCatalogItem[], deps);
        break;
    }
  }
  private async handleCatalog(payload: MissionCatalogItem[], deps: PersistDeps): Promise<void> {
    // 填充内存缓存（无论是否写 DB 都执行）
    cacheMissionNames(payload.map(m => ({ id: m.id, name: m.name })));

    if (!deps.repos?.mission) return;

    // Diff 检查：加载 DB 中已有的 id+name，若完全一致则跳过写入
    try {
      const existing = await deps.repos.mission.listIdNames();
      if (existing.length === payload.length) {
        const dbMap = new Map(existing.map(r => [r.id, r.name]));
        const unchanged = payload.every(m => dbMap.get(m.id) === m.name);
        if (unchanged) {
          console.debug('[persist][EXPEDITION_CATALOG] no changes, skip upsert');
          return;
        }
      }

      const rows: MissionRow[] = payload.map(m => ({
        id: m.id,
        code: m.code ?? null,
        mapAreaId: m.mapAreaId ?? null,
        name: m.name,
        details: m.details ?? null,
        resetType: m.resetType ?? null,
        damageType: m.damageType ?? null,
        timeMin: m.timeMin ?? null,
        requireShips: m.requireShips ?? null,
        difficulty: m.difficulty ?? null,
        fuelPct: m.costRatio?.fuelPct ?? null,
        ammoPct: m.costRatio?.ammoPct ?? null,
        reward_item1_id: m.reward?.winItem1?.itemId ?? null,
        reward_item1_count: m.reward?.winItem1?.count ?? null,
        reward_item2_id: m.reward?.winItem2?.itemId ?? null,
        reward_item2_count: m.reward?.winItem2?.count ?? null,
        mat0: m.reward?.matLevel?.[0] ?? null,
        mat1: m.reward?.matLevel?.[1] ?? null,
        mat2: m.reward?.matLevel?.[2] ?? null,
        mat3: m.reward?.matLevel?.[3] ?? null,
        returnCancelable: m.returnCancelable ? 1 : 0,
        sampleFleet: m.sampleFleet?.length ? JSON.stringify(m.sampleFleet) : null,
        updatedAt: m.updatedAt,
      }));

      await deps.repos.mission.upsertBatch(rows);
      console.info(`[persist][EXPEDITION_CATALOG] upserted ${rows.length} missions`);
    } catch (e) {
      console.warn('[persist][EXPEDITION_CATALOG] failed:', e);
    }
  }

  private async handleStart(payload: MissionStart, ts: number, deps: PersistDeps) {
    const row: ExpeditionRow = {
      deckId: i32(payload.deckId, 0),
      missionId: i32(payload.missionId, 0),
      progress: ExpeditionProgress.RUNNING,
      returnTime: i64(payload.complTime, 0),
      updatedAt: i64(payload.updatedAt ?? ts, ts),
    };
    await deps.repos!.expedition.upsertBatch([row]);
    triggerExpeditionChanged();
  }

  private async handleUpdate(payload: ExpeditionSlotState[], ts: number, deps: PersistDeps) {
    const rows: ExpeditionRow[] = payload.map(s => ({
      deckId: i32(s.deckId, 0),
      missionId: i32(s.missionId, 0),
      progress: i32(s.progress, 0),
      returnTime: i64(s.returnTime, 0),
      updatedAt: i64(s.updatedAt ?? ts, ts),
    }));
    await deps.repos!.expedition.upsertBatch(rows);
    triggerExpeditionChanged();
  }

  private async handleResult(payload: MissionResult, ts: number, deps: PersistDeps) {
    const finishedAt = i64(payload.finishedAt ?? ts, ts);
    const stateRow: ExpeditionRow = {
      deckId: i32(payload.deckId, 0),
      missionId: i32(payload.missionId, 0),
      progress: ExpeditionProgress.IDLE,
      returnTime: 0,
      updatedAt: finishedAt,
    };
    await deps.repos!.expedition.upsertBatch([stateRow]);

    try {
      const resultRow: ExpeditionResultRow = {
        deckId: i32(payload.deckId, 0),
        missionId: i32(payload.missionId, 0),
        clear: payload.clear,
        admiral_lv: payload.admiral?.lv ?? null,
        admiral_getExp: payload.admiral?.getExp ?? null,
        materials: payload.drops.materials ? JSON.stringify(payload.drops.materials) : null,
        items: payload.drops.items?.length
          ? JSON.stringify(payload.drops.items.map(it => ({ id: it.id, count: it.count })))
          : null,
        finishedAt,
      };
      await deps.repos!.expeditionResult.insert(resultRow);
    } catch (e) {
      console.warn('[persist][EXPEDITION] result insert failed:', e);
    }

    triggerExpeditionChanged();
  }
}
const handler = new ExpeditionHandler();
registerHandler('EXPEDITION_START', handler);
registerHandler('EXPEDITION_UPDATE', handler);
registerHandler('EXPEDITION_RESULT', handler);
registerHandler('EXPEDITION_CATALOG', handler);