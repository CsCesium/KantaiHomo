import { AnyStart2Evt } from '../../../domain/events/start2';
import { ApiMstMissionRaw, ApiMstShipRaw, ApiMstSlotitemRaw } from '../../../domain/models/api/start2';
import { ApiMstSlotItemRaw } from '../../../domain/models/api/mst_slotitem';
import { normalizeMstSlotItem } from '../../../domain/models/normalizer/mst_slotitem';
import { slotItemMasterToRow } from '../../../domain/models/mapper/slotitem';
import { MissionRow, ShipGraphRow, ShipMasterRow } from '../../../infra/storage/types';
import { updateShipGraphFilenames, updateShipMasterMeta, updateSlotItemEquipTypes, setGameServerUrl } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

// ── Raw → ShipMasterRow (no intermediate domain struct needed) ──
function shipRawToRow(raw: ApiMstShipRaw, ts: number): ShipMasterRow {
  return {
    id: raw.api_id,
    sortNo: raw.api_sortno ?? raw.api_sort_id ?? 0,
    name: raw.api_name ?? '',
    stype: raw.api_stype ?? null,
    ctype: raw.api_ctype ?? null,
    speed: raw.api_soku ?? null,
    range: raw.api_leng ?? null,
    slotNum: raw.api_slot_num ?? null,
    maxEqJson: Array.isArray(raw.api_maxeq) ? JSON.stringify(raw.api_maxeq) : null,
    afterLv: raw.api_afterlv ?? null,
    afterShipId: raw.api_aftershipid ? (parseInt(raw.api_aftershipid) || null) : null,
    updatedAt: ts,
  };
}

// ── Raw → MissionRow ──
function missionRawToRow(raw: ApiMstMissionRaw, ts: number): MissionRow {
  return {
    id: raw.api_id,
    code: raw.api_disp_no ?? null,
    mapAreaId: raw.api_maparea_id ?? null,
    name: raw.api_name,
    details: raw.api_details ?? null,
    resetType: raw.api_reset_type === 1 ? 'monthly' : 'normal',
    damageType: raw.api_damage_type ?? null,
    timeMin: raw.api_time ?? null,
    requireShips: raw.api_deck_num ?? null,
    difficulty: raw.api_difficulty ?? null,
    fuelPct: raw.api_use_fuel ?? null,
    ammoPct: raw.api_use_bull ?? null,
    reward_item1_id: raw.api_win_item1?.[0] ?? null,
    reward_item1_count: raw.api_win_item1?.[1] ?? null,
    reward_item2_id: raw.api_win_item2?.[0] ?? null,
    reward_item2_count: raw.api_win_item2?.[1] ?? null,
    mat0: raw.api_win_mat_level?.[0] ?? null,
    mat1: raw.api_win_mat_level?.[1] ?? null,
    mat2: raw.api_win_mat_level?.[2] ?? null,
    mat3: raw.api_win_mat_level?.[3] ?? null,
    returnCancelable: raw.api_return_flag ?? null,
    sampleFleet: raw.api_sample_fleet ? JSON.stringify(raw.api_sample_fleet) : null,
    updatedAt: ts,
  };
}

// ── Diff helper ──
function hasChanges(
  existing: ReadonlyArray<{ id: number; name: string }>,
  incoming: ReadonlyArray<{ id: number; name: string }>,
): boolean {
  if (existing.length !== incoming.length) return true;
  const dbMap = new Map(existing.map(r => [r.id, r.name]));
  return incoming.some(m => dbMap.get(m.id) !== m.name);
}

class Start2Handler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as AnyStart2Evt;
    const ts = ev.timestamp ?? Date.now();

    switch (e.type) {
      case 'SHIP_MASTER_CATALOG':
        await this.handleShipMaster(e.payload, ts, deps);
        break;
      case 'SLOTITEM_MASTER_CATALOG':
        await this.handleSlotItemMaster(e.payload, ts, deps);
        break;
      case 'MISSION_MASTER_CATALOG':
        await this.handleMissionMaster(e.payload, ts, deps);
        break;
      case 'SHIP_GRAPH_CATALOG':
        await this.handleShipGraph(e.payload.graphs, e.payload.serverBase, ts, deps);
        break;
    }
  }

  private async handleShipMaster(payload: ApiMstShipRaw[], ts: number, deps: PersistDeps): Promise<void> {
    // 更新内存缓存（名称和最大补给量）
    const metaItems = payload.map(r => ({
      id: r.api_id,
      name: r.api_name ?? '',
      fuelMax: r.api_fuel_max ?? 0,
      ammoMax: r.api_bull_max ?? 0,
      soku: r.api_soku,
      stype: r.api_stype,
    }));
    updateShipMasterMeta(metaItems);

    if (!deps.repos?.ship) return;
    try {
      const existing = await deps.repos.ship.listMasterIdNames();
      if (!hasChanges(existing, payload.map(r => ({ id: r.api_id, name: r.api_name ?? '' })))) {
        console.debug('[persist][SHIP_MASTER] no changes, skip upsert');
        return;
      }
      const rows = payload.map(r => shipRawToRow(r, ts));
      await deps.repos.ship.upsertMasterBatch(rows);
      console.info(`[persist][SHIP_MASTER] upserted ${rows.length} ship masters`);
    } catch (e) {
      console.warn('[persist][SHIP_MASTER] failed:', e);
    }
  }

  private async handleMissionMaster(payload: ApiMstMissionRaw[], ts: number, deps: PersistDeps): Promise<void> {
    if (!deps.repos?.mission) return;
    try {
      const existing = await deps.repos.mission.listIdNames();
      if (!hasChanges(existing, payload.map(r => ({ id: r.api_id, name: r.api_name })))) {
        console.debug('[persist][MISSION_MASTER] no changes, skip upsert');
        return;
      }
      const rows = payload.map(r => missionRawToRow(r, ts));
      await deps.repos.mission.upsertBatch(rows);
      console.info(`[persist][MISSION_MASTER] upserted ${rows.length} missions`);
    } catch (e) {
      console.warn('[persist][MISSION_MASTER] failed:', e);
    }
  }

  private async handleShipGraph(
    payload: { api_id: number; api_filename: string }[],
    serverBase: string,
    ts: number,
    deps: PersistDeps,
  ): Promise<void> {
    if (serverBase) {
      setGameServerUrl(serverBase);
    }

    // Update in-memory filename cache
    const filenames = payload.map(r => ({ id: r.api_id, filename: r.api_filename }));
    updateShipGraphFilenames(filenames);

    if (!deps.repos?.shipGraph) return;
    try {
      const rows: ShipGraphRow[] = payload.map(r => ({
        id: r.api_id,
        filename: r.api_filename,
        updatedAt: ts,
      }));
      await deps.repos.shipGraph.upsertBatch(rows);
      console.info(`[persist][SHIP_GRAPH] upserted ${rows.length} ship graph entries`);
    } catch (e) {
      console.warn('[persist][SHIP_GRAPH] failed:', e);
    }
  }

  private async handleSlotItemMaster(payload: ApiMstSlotitemRaw[], ts: number, deps: PersistDeps): Promise<void> {
    // 更新内存缓存（装备类型/图标）：api_type[2]/[3]
    const equipTypeItems = payload.map(r => ({
      id: r.api_id,
      equipType: Array.isArray(r.api_type) ? (r.api_type[2] ?? 0) : 0,
      iconType: Array.isArray(r.api_type) ? (r.api_type[3] ?? 0) : 0,
      los: r.api_saku ?? 0,
      aa: r.api_tyku ?? 0,
      name: r.api_name ?? '',
    }));
    updateSlotItemEquipTypes(equipTypeItems);

    if (!deps.repos?.slotitem) return;
    try {
      const existing = await deps.repos.slotitem.listMasterIdNames();
      if (!hasChanges(existing, payload.map(r => ({ id: r.api_id, name: r.api_name ?? '' })))) {
        console.debug('[persist][SLOTITEM_MASTER] no changes, skip upsert');
        return;
      }
      const rows = payload.map(r => {
        const master = normalizeMstSlotItem(r as unknown as ApiMstSlotItemRaw, ts);
        return slotItemMasterToRow(master);
      });
      await deps.repos.slotitem.upsertMasterBatch(rows);
      console.info(`[persist][SLOTITEM_MASTER] upserted ${rows.length} slotitem masters`);
    } catch (e) {
      console.warn('[persist][SLOTITEM_MASTER] failed:', e);
    }
  }
}

const handler = new Start2Handler();
registerHandler('SHIP_MASTER_CATALOG', handler);
registerHandler('SLOTITEM_MASTER_CATALOG', handler);
registerHandler('MISSION_MASTER_CATALOG', handler);
registerHandler('SHIP_GRAPH_CATALOG', handler);
