import { getShipImagePath, ShipGraphType } from '../game/shipGraph';

export const APP_STORAGE_SHIP_MODS_ENABLED = 'shipMods.enabled';
export const MAX_MOD_BYTES = 32 * 1024 * 1024;
export const MAX_MOD_PIXELS = 16 * 1024 * 1024;

export interface ShipModType {
  type: ShipGraphType;
  label: string;
  damage: 'select' | 'always' | 'never';
}

export const SHIP_MOD_TYPES: ShipModType[] = [
  { type: 'banner', label: '横幅 / banner', damage: 'select' },
  { type: 'full', label: '全图 / full', damage: 'select' },
  { type: 'character_full', label: '无框全身 / character_full', damage: 'select' },
  { type: 'character_up', label: '无框半身 / character_up', damage: 'select' },
  { type: 'card', label: '卡面 / card', damage: 'select' },
  { type: 'remodel', label: '改修立绘 / remodel', damage: 'select' },
  { type: 'supply_character', label: '补给立绘 / supply_character', damage: 'select' },
  { type: 'album_status', label: '图鉴状态 / album_status', damage: 'never' },
  { type: 'banner_g', label: '特殊横幅 / banner_g', damage: 'always' },
  { type: 'banner2_g', label: '特殊横幅 2 / banner2_g', damage: 'always' },
  { type: 'banner3_g', label: '特殊横幅 3 / banner3_g', damage: 'always' },
];

export interface ShipModTarget {
  masterId: number;
  type: ShipGraphType;
  damaged: boolean;
}

export interface ShipModRecord extends ShipModTarget {
  resourcePath: string;
  localPath: string;
  size: number;
  modifiedAt: number;
}

export function shipModResourcePath(target: ShipModTarget): string {
  if (!Number.isInteger(target.masterId) || target.masterId <= 0 || target.masterId >= 1500 ||
    !SHIP_MOD_TYPES.some((item: ShipModType) => item.type === target.type)) {
    throw new Error('请选择有效的舰娘和立绘类型');
  }
  return getShipImagePath(target.masterId, target.type, target.damaged);
}

export function shipModRelativePath(target: ShipModTarget): string {
  const path = shipModResourcePath(target);
  return `${target.masterId}/${path.substring('/kcs2/resources/ship/'.length)}`;
}

export function shipModLabel(target: ShipModTarget): string {
  const spec = SHIP_MOD_TYPES.find((item: ShipModType) => item.type === target.type);
  const damaged = spec?.damage === 'always' || (spec?.damage === 'select' && target.damaged);
  return `${spec?.label ?? target.type} · ${damaged ? '中破' : '通常'}`;
}

/** Only official ship paths; version queries do not change the chosen replacement. */
export function shipModRequestPath(requestUrl: string): string | null {
  const match = requestUrl.match(/^https?:\/\/[^/?#]+(\/kcs2\/resources\/ship\/[a-z0-9_]+\/\d{4}_\d{4}\.png)(?:[?#].*)?$/i);
  return match ? match[1] : null;
}
