//src/main/ets/features/router/persist/ingest/webDump.ets
import taskpool from '@ohos.taskpool'
import { ApiDump } from "../../../../infra/web/types";
import '../../../parsers/pipelines'; // trigger side-effect pipeline registrations
// trigger side-effect handler registrations (must come after executor/registry are loaded)
import '../../handlers/session';
import '../../handlers/port';
import '../../handlers/expedition';
import '../../handlers/quest';
import '../../handlers/start2';
import '../../handlers/battle';
import '../../handlers/sortie';
import '../../handlers/ranking';
import '../../handlers/mapinfo';
import '../../handlers/supply';
import '../../handlers/lbas';
import '../../handlers/slotitem';
import '../../handlers/require_info';
import '../../handlers/kousyou';
import type { PersistDeps } from '../type';
import { parseDumpInWorker } from './webDumpTask'
import { parseDump, ParseResult } from '../../../parsers/pipeline';
import { dispatchEvent } from '../executor';
import { parseSvdata, parseSvdataAndUnwrap } from '../../../utils/common';
import { ApiStateFields, detectStateFields } from '../../../../domain/models/api/response';
import {
  extractAndUpdateState,
  markShipsEscaped,
  getNDocks,
  getShip,
  getMaterials,
  patchMaterials,
  patchShipsHp,
  patchDeckShip,
  patchShipSlot,
  patchShipExSlot,
  patchShipUnsetSlots,
  patchShipSlotExchange,
  patchShipSlotDeprive,
  updateFromPort
} from '../../../state';
import { getSortieContext } from '../../../../domain/service';
import { parseFormBody } from '../../../utils/common';

const HEAVY_THRESHOLD: number = 256 * 1024         // >=256KB to TaskPool
const WORKER_MAX_INPUT: number = 14 * 1024 * 1024  // 16MB

interface ApiResponseProbeData {
  api_material?: object[];
  api_bauxite?: number;
  api_ship?: object | object[] | null;
  api_ship_data?: object | object[] | null;
}

interface ApiResponseProbe {
  api_result?: number | string;
  api_data?: ApiResponseProbeData | null;
}

interface ApiDeckData {
  api_id?: number;
  api_name?: string;
  api_ship?: number[];
  api_mission?: number[];
}

interface ApiDeckResponseData extends ApiDeckData {
  api_deck_data?: ApiDeckData[] | null;
}

interface ApiDeckResponseProbe {
  api_result?: number | string;
  api_data?: ApiDeckResponseData | null;
}

interface ApiDeckStatePatch {
  api_deck_data: ApiDeckData[];
}

function totalSize(d: ApiDump): number {
  const a: number = d.requestBody?.length ?? 0
  const b: number = d.responseText?.length ?? 0
  return a + b
}

async function executeParseResult(result: ParseResult, deps: PersistDeps): Promise<void> {
  // 1. 串行执行 preEvents（如 SESSION_BIND 会切换 DB，必须先完成）
  for (const ev of result.preEvents) {
    try {
      await dispatchEvent(ev, deps);
    } catch (e) {
      console.error('[persist] preEvent failed:', ev.type, String(e));
    }
  }

  // 2. 串行执行 mainEvents
  // 注意：不能并发执行——多个 handler 同时调用 withTransaction 会在同一个
  // SQLite 连接上并发调用 beginTransaction()，SQLite 不支持嵌套事务，
  // 除第一个外所有事务都会抛出异常，导致数据写入静默失败。
  for (const ev of result.mainEvents) {
    try {
      await dispatchEvent(ev, deps);
    } catch (e) {
      console.error('[persist] mainEvent failed:', ev.type, String(e));
    }
  }

  // 3. 串行执行 postEvents
  if (result.postEvents) {
    for (const ev of result.postEvents) {
      try {
        await dispatchEvent(ev, deps);
      } catch (e) {
        console.error('[persist] postEvent failed:', ev.type, String(e));
      }
    }
  }
}

/**
 * 判断 ParseResult 是否为空
 */
function isEmptyResult(result: ParseResult): boolean {
  return result.preEvents.length === 0
    && result.mainEvents.length === 0
    && (!result.postEvents || result.postEvents.length === 0);
}

function isSuccessfulApiResponse(responseText: string | null | undefined): boolean {
  const root = parseSvdata<ApiResponseProbe>(responseText);
  if (!root) return false;
  const result = root.api_result;
  if (result === undefined) return true;
  return Number(result) === 1;
}

function responseHasMaterial(responseText: string | null | undefined): boolean {
  const root = parseSvdata<ApiResponseProbe>(responseText);
  const data = root?.api_data;
  return data !== null && data !== undefined && Array.isArray(data.api_material);
}

function responseHasShipData(responseText: string | null | undefined): boolean {
  const root = parseSvdata<ApiResponseProbe>(responseText);
  const data = root?.api_data;
  if (data === null || data === undefined) return false;
  return (data.api_ship !== undefined && data.api_ship !== null) ||
    (data.api_ship_data !== undefined && data.api_ship_data !== null);
}

function patchBauxiteFromResponse(responseText: string | null | undefined): void {
  const root = parseSvdata<ApiResponseProbe>(responseText);
  const data = root?.api_data;
  if (data === null || data === undefined || typeof data.api_bauxite !== 'number') return;

  patchMaterials({ bauxite: data.api_bauxite });
}

function deckProbeIsDeck(data: ApiDeckData | null | undefined): boolean {
  return data !== null && data !== undefined &&
    typeof data.api_id === 'number' &&
    Array.isArray(data.api_ship);
}

function patchDeckFromResponse(responseText: string | null | undefined): void {
  const root = parseSvdata<ApiDeckResponseProbe>(responseText);
  const data = root?.api_data;
  if (data === null || data === undefined) return;

  const decks: ApiDeckData[] = [];
  if (Array.isArray(data.api_deck_data)) {
    for (const deck of data.api_deck_data) {
      if (deckProbeIsDeck(deck)) decks.push(deck);
    }
  } else if (deckProbeIsDeck(data)) {
    decks.push(data);
  }

  if (decks.length === 0) return;
  const patch: ApiDeckStatePatch = { api_deck_data: decks };
  extractAndUpdateState(patch);
}

function patchPanelStateFromHenseiRequest(dump: ApiDump): void {
  const url = dump.url ?? '';
  if (!url.includes('/api_req_hensei/')) return;
  if (!isSuccessfulApiResponse(dump.responseText)) return;

  if (url.includes('/api_req_hensei/preset_select')) {
    patchDeckFromResponse(dump.responseText);
    return;
  }
  if (url.includes('/api_req_hensei/combined')) {
    const params = parseFormBody(dump.requestBody);
    updateFromPort({ combinedFleetType: params.getInt('api_combined_type', 0) });
    return;
  }
  if (!url.includes('/api_req_hensei/change')) return;

  const params = parseFormBody(dump.requestBody);
  const deckId = params.getInt('api_id', 0);
  const shipUid = params.getInt('api_ship_id', 0);
  const shipIdx = params.getInt('api_ship_idx', 0);
  patchDeckShip(deckId, shipIdx, shipUid);
}

function completeRepairForShip(shipUid: number, consumeBucket: boolean): void {
  if (shipUid <= 0) return;
  const ship = getShip(shipUid);
  if (!ship || ship.hpMax <= 0) return;

  patchShipsHp([{ uid: shipUid, hpNow: ship.hpMax, hpMax: ship.hpMax }]);
  const materials = getMaterials();
  if (consumeBucket && materials && materials.instantRepair > 0) {
    patchMaterials({ instantRepair: materials.instantRepair - 1 });
  }
}

function patchPanelStateFromNyukyoRequest(dump: ApiDump): void {
  const url = dump.url ?? '';
  if (!url.includes('/api_req_nyukyo/')) return;
  if (!isSuccessfulApiResponse(dump.responseText)) return;

  const params = parseFormBody(dump.requestBody);
  const consumeBucket = !responseHasMaterial(dump.responseText);
  if (url.includes('/api_req_nyukyo/start')) {
    if (params.getInt('api_highspeed', 0) === 1) {
      completeRepairForShip(params.getInt('api_ship_id', 0), consumeBucket);
    }
    return;
  }
  if (url.includes('/api_req_nyukyo/speedchange')) {
    const dockId = params.getInt('api_ndock_id', 0);
    const dock = getNDocks().find(item => item.dockId === dockId);
    completeRepairForShip(dock?.shipUid ?? 0, consumeBucket);
  }
}

function patchPanelStateFromKaisouRequest(dump: ApiDump): void {
  const url = dump.url ?? '';
  if (!url.includes('/api_req_kaisou/')) return;
  if (!isSuccessfulApiResponse(dump.responseText)) return;

  const params = parseFormBody(dump.requestBody);
  const hasResponseShipData = responseHasShipData(dump.responseText);

  if (url.includes('/api_req_kaisou/preset_slot_select')) {
    patchBauxiteFromResponse(dump.responseText);
    return;
  }

  if (url.includes('/api_req_kaisou/slot_deprive')) {
    if (!hasResponseShipData) {
      patchShipSlotDeprive(
        params.getInt('api_unset_ship', 0),
        params.getInt('api_set_ship', 0),
        params.getInt('api_unset_slot_kind', -1),
        params.getInt('api_set_slot_kind', -1),
        params.getInt('api_unset_idx', -1),
        params.getInt('api_set_idx', -1)
      );
    }
    return;
  }

  if (url.includes('/api_req_kaisou/slotset_ex')) {
    patchShipExSlot(params.getInt('api_id', 0), params.getInt('api_item_id', -1));
    return;
  }
  if (url.includes('/api_req_kaisou/slotset')) {
    patchShipSlot(
      params.getInt('api_id', 0),
      params.getInt('api_slot_idx', -1),
      params.getInt('api_item_id', -1)
    );
    return;
  }
  if (url.includes('/api_req_kaisou/unsetslot_all')) {
    patchShipUnsetSlots(params.getInt('api_id', 0));
    return;
  }
  if (url.includes('/api_req_kaisou/slot_exchange_index')) {
    if (!hasResponseShipData) {
      patchShipSlotExchange(
        params.getInt('api_id', 0),
        params.getInt('api_src_idx', -1),
        params.getInt('api_dst_idx', -1)
      );
    }
  }
}

export async function ingestDump(dump: ApiDump, deps: PersistDeps): Promise<void> {
  const size: number = totalSize(dump)

  let result: ParseResult = { preEvents: [], mainEvents: [] };
  // 提取状态（补给 API 的 api_material 为 number[] 格式，由专用 pipeline 处理，跳过通用提取；
  // port 也交给专用 handler，保证先清战斗/出击临时状态再写入港内数据）
  const isCharge = dump.url?.includes('/api_req_hokyu/charge');
  const isPort = dump.url?.includes('/api_port/port');
  if (!isCharge && !isPort) {
    try {
      const apiData = parseSvdataAndUnwrap<ApiStateFields>(dump.responseText);
      if(apiData) {
        const fields = detectStateFields(apiData);
        if (fields.hasAdmiral || fields.hasMaterials || fields.hasDecks || fields.hasShips ||
            fields.hasNdock || fields.hasKdock) {
          extractAndUpdateState(apiData);
        }
      }
    } catch (e) {
      console.debug('[ingest] state extract skipped:', String(e));
    }
  }
  patchPanelStateFromHenseiRequest(dump);
  patchPanelStateFromNyukyoRequest(dump);
  patchPanelStateFromKaisouRequest(dump);

  // 退避机制：实际 goback_port 请求体通常只包含 api_token/api_verno，
  // 退避对象来自上一条 battleresult.api_escape。BattleHandler 会先把候选 UID
  // 暂存在 SortieContext.pendingEscapeUids；这里仅在 goback_port 成功后确认。
  // 旧的 requestBody.api_escape_idx 解析只作为兼容兜底。
  const isGobackPort = dump.url?.includes('/api_req_combined_battle/goback_port')
    || dump.url?.includes('/api_req_sortie/goback_port');
  if (isGobackPort && isSuccessfulApiResponse(dump.responseText)) {
    try {
      const ctx = getSortieContext();
      let uids: number[] = ctx?.pendingEscapeUids ? Array.from(ctx.pendingEscapeUids) : [];
      if (ctx?.pendingEscapeUids) {
        ctx.pendingEscapeUids = undefined;
      }

      if (uids.length === 0) {
        const params = parseFormBody(dump.requestBody);
        const idxRaw = params.getString('api_escape_idx');
        if (idxRaw) {
          const positions = idxRaw.split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => Number.isFinite(n) && n >= 1 && n <= 12);
          const mainShips = ctx?.fleetSnapshot?.ships;
          const escortShips = ctx?.fleetSnapshotEscort?.ships;
          uids = [];
          for (const pos of positions) {
            // 优先按规范：1-6 → main，7-12 → escort。
            // 没有护卫舰队时按主队 1-based 序号映射，覆盖游击队第 7 艘单舰退避。
            let uid = 0;
            if (pos <= 6) {
              uid = mainShips?.[pos - 1]?.uid ?? 0;
            } else if (escortShips) {
              uid = escortShips[pos - 7]?.uid ?? 0;
            } else {
              uid = mainShips?.[pos - 1]?.uid ?? 0;
            }
            if (uid > 0) uids.push(uid);
          }
        }
      }

      if (uids.length > 0) {
        markShipsEscaped(uids);
        console.info('[ingest] escaped ships:', uids.join(','));
      }
    } catch (e) {
      console.warn('[ingest] goback_port parse failed:', String(e));
    }
  }

  // 过大：不进 worker, 仍然允许主线程尝试解析；
  if (size > WORKER_MAX_INPUT) {
    try {
      result = parseDump(dump)
    } catch (e) {
      console.error('[persist] parse too large failed:', String(e))
      return
    }
  } else if (size >= HEAVY_THRESHOLD) {
    try {
      result = await taskpool.execute(
        parseDumpInWorker,
        dump.url ?? '',
        dump.requestBody ?? '',
        dump.responseText ?? ''
      ) as ParseResult
    } catch (e) {
      // worker failed：backward to MainThread
      try {
        result = parseDump(dump)
      } catch (e2) {
        console.error('[persist] parse fallback failed:', String(e2))
        return
      }
    }
  } else {
    try {
      result = parseDump(dump)
    } catch (e) {
      console.error('[persist] parse failed:', String(e))
      return
    }
  }

  if (isEmptyResult(result)) return

  await executeParseResult(result, deps);
}
