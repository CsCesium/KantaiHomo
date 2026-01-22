import { ApiMstSlotItemRaw, ApiMstStatLike } from "../api/mst_slotitem";
import {
  SlotItemTypeInfo,
  SlotItemMajorType,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemAircraftCategory,
  SlotItemMaster,
  SlotItemMasterStats
} from "../struct/slotitem";

function readStat(v: ApiMstStatLike | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (Array.isArray(v) && v.length > 0) {
    const last = v[v.length - 1];
    return typeof last === 'number' && Number.isFinite(last) ? last : 0;
  }
  return 0;
}
function readTypeInfo(typeArr: unknown): SlotItemTypeInfo {
  const a = Array.isArray(typeArr) ? typeArr : [];
  const n = (i: number): number => {
    const v = a[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };

  return {
    major: n(0) as SlotItemMajorType,
    book: n(1) as SlotItemBookCategory,
    equipType: n(2) as SlotItemEquipType,
    iconId: n(3) as SlotItemIconId,
    aircraft: n(4) as SlotItemAircraftCategory,
  };
}


function pickExtras(raw: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined {
  const extras: Record<string, unknown> = {};
  for (const k in raw) {
    if (!known.has(k)) extras[k] = raw[k];
  }
  return Object.keys(extras).length > 0 ? extras : undefined;
}

const KNOWN_KEYS = new Set<string>([
  'api_id', 'api_sortno', 'api_name', 'api_type',
  'api_taik', 'api_souk', 'api_houg', 'api_raig', 'api_soku',
  'api_baku', 'api_tyku', 'api_tais',
  'api_atap', 'api_houm', 'api_raim', 'api_houk', 'api_raik', 'api_bakk',
  'api_saku', 'api_sakb', 'api_luck',
  'api_leng', 'api_cost', 'api_distance', 'api_rare',
  'api_broken', 'api_usebull', 'api_version',
]);


export function normalizeMstSlotItem(raw: ApiMstSlotItemRaw, ts: number): SlotItemMaster {
  const stats: SlotItemMasterStats = {
    hp: readStat(raw.api_taik),
    armor: readStat(raw.api_souk),
    firepower: readStat(raw.api_houg),
    torpedo: readStat(raw.api_raig),
    speed: readStat(raw.api_soku),
    bomb: readStat(raw.api_baku),
    aa: readStat(raw.api_tyku),
    asw: readStat(raw.api_tais),
    hit: readStat(raw.api_houm),
    evasion: readStat(raw.api_houk),
    los: readStat(raw.api_saku),
    luck: readStat(raw.api_luck),
  };

  const broken = Array.isArray(raw.api_broken)
    ? raw.api_broken.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : 0))
    : [];

  return {
    id: raw.api_id,
    sortNo: raw.api_sortno,
    name: String(raw.api_name ?? ''),
    type: readTypeInfo(raw.api_type),

    rarity: typeof raw.api_rare === 'number' ? raw.api_rare : 0,
    range: typeof raw.api_leng === 'number' ? raw.api_leng : 0,

    stats,
    broken,

    cost: typeof raw.api_cost === 'number' ? raw.api_cost : undefined,
    distance: typeof raw.api_distance === 'number' ? raw.api_distance : undefined,
    useBull: typeof raw.api_usebull === 'number' ? raw.api_usebull : undefined,
    gfxVersion: typeof raw.api_version === 'number' ? raw.api_version : undefined,

    updatedAt: ts,
    extras: pickExtras(raw as unknown as Record<string, unknown>, KNOWN_KEYS),
  };
}

export function normalizeMstSlotItems(list: ApiMstSlotItemRaw[], ts: number): SlotItemMaster[] {
  return Array.isArray(list) ? list.map(x => normalizeMstSlotItem(x, ts)) : [];
}