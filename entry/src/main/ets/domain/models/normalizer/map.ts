import { ApiMapStartRespRaw, ApiMapNextRespRaw, ApiMapResourceItemRaw } from "../api/map";
import { SortieCell, MapResourceGain } from "../struct/map";

const RESOURCE_NAME_BY_ID: Record<number, string> = {
  1: '燃料',
  2: '弹药',
  3: '钢材',
  4: '铝土',
  5: '高速建造材',
  6: '高速修复材',
  7: '开发资材',
  8: '改修资材',
};

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getCellId(raw: ApiMapStartRespRaw | ApiMapNextRespRaw): number {
  return asNumber(raw.api_cell_id) ?? asNumber(raw.api_no) ?? 0;
}

function isBossCell(
  cellId: number,
  colorNo: number | undefined,
  bossCellNo: number | undefined
): boolean {
  return colorNo === 5 || (bossCellNo !== undefined && bossCellNo === cellId);
}

function getResourceName(itemId: number | undefined, iconId: number | undefined): string {
  if (itemId !== undefined && RESOURCE_NAME_BY_ID[itemId]) return RESOURCE_NAME_BY_ID[itemId];
  if (iconId !== undefined && RESOURCE_NAME_BY_ID[iconId]) return RESOURCE_NAME_BY_ID[iconId];
  const fallbackId = itemId ?? iconId;
  return fallbackId !== undefined ? `物资${fallbackId}` : '资源';
}

function normalizeResourceGain(raw: ApiMapResourceItemRaw): MapResourceGain | null {
  const count = asNumber(raw.api_getcount) ?? asNumber(raw.api_count) ?? 0;
  if (count === 0) return null;

  const itemId = asNumber(raw.api_id) ?? asNumber(raw.api_item_id);
  const iconId = asNumber(raw.api_icon_id);
  const rawName = typeof raw.api_name === 'string' ? raw.api_name.trim() : '';

  return {
    name: rawName.length > 0 ? rawName : getResourceName(itemId, iconId),
    count,
    itemId,
    iconId,
  };
}

function normalizeResourceGains(raw: ApiMapStartRespRaw | ApiMapNextRespRaw): MapResourceGain[] | undefined {
  const itemget = raw.api_itemget;
  const items: ApiMapResourceItemRaw[] = Array.isArray(itemget) ? itemget : itemget ? [itemget] : [];
  const gains: MapResourceGain[] = [];
  for (const item of items) {
    const gain = normalizeResourceGain(item);
    if (gain) {
      gains.push(gain);
    }
  }

  return gains.length > 0 ? gains : undefined;
}

export function normalizeSortieCell(raw: ApiMapStartRespRaw | ApiMapNextRespRaw, now: number = Date.now()): SortieCell {
  const cellId = getCellId(raw);
  const colorNo = asNumber(raw.api_color_no);
  const bossCellNo = asNumber(raw.api_bosscell_no);

  return {
    mapAreaId: raw.api_maparea_id,
    mapInfoNo: raw.api_mapinfo_no,
    cellId,
    eventId: asNumber(raw.api_event_id) ?? 0,
    eventKind: asNumber(raw.api_event_kind) ?? 0,
    next: asNumber(raw.api_next) ?? 0,
    isBoss: isBossCell(cellId, colorNo, bossCellNo),
    bossCellNo,
    colorNo,
    resourceGains: normalizeResourceGains(raw),
    updatedAt: now,
    extras: raw,
  };
}

/** 解析出击开始 (api_req_map/start) */
export function normalizeMapStart(raw: ApiMapStartRespRaw, now: number = Date.now()): SortieCell {
  return normalizeSortieCell(raw, now);
}

/** 解析进入下一节点 (api_req_map/next) */
export function normalizeMapNext(raw: ApiMapNextRespRaw, now: number = Date.now()): SortieCell {
  return normalizeSortieCell(raw, now);
}
