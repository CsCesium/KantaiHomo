/**
 * ship graph cipher and URL builder.
 *
 */

//Tanaka's magic
const RESOURCE = [
  6657, 5699, 3371, 8909, 7719, 6229, 5449, 8561, 2987, 5501, 3127, 9319, 4365, 9811, 9927, 2423,
  3439, 1865, 5925, 4409, 5509, 1517, 9695, 9255, 5325, 3691, 5519, 6949, 5607, 9539, 4133, 7795,
  5465, 2659, 6381, 6875, 4019, 9195, 5645, 2887, 1213, 1815, 8671, 3015, 3147, 2991, 7977, 7045,
  1619, 7909, 4451, 6573, 4545, 8251, 5983, 2849, 7249, 7449, 9477, 5963, 2711, 9019, 7375, 2201,
  5631, 4893, 7653, 3719, 8819, 5839, 1853, 9843, 9119, 7023, 5681, 2345, 9873, 6349, 9315, 3795,
  9737, 4633, 4173, 7549, 7171, 6147, 4723, 5039, 2723, 7815, 6201, 5999, 5339, 4431, 2911, 4435,
  3611, 4423, 9517, 3243,
];

export type ShipGraphType =
  | 'banner'
  | 'banner_g'
  | 'banner2_g'
  | 'banner3_g'
  | 'card'
  | 'remodel'
  | 'character_up'
  | 'character_full'
  | 'full'
  | 'supply_character'
  | 'album_status';

const DAMAGED_FORCE_TYPES: ReadonlySet<string> = new Set(['banner_g', 'banner2_g', 'banner3_g']);
const ENEMY_DAMAGED_EXCEPTIONS: ReadonlySet<number> = new Set([1587, 1588, 1589, 1590]);
const SHIP_IMAGE_PATH_CACHE: Map<string, string> = new Map();

function createKey(keyString: string): number {
  let key = 0;
  if (keyString != null && keyString !== '') {
    for (let i = 0; i < keyString.length; i++) {
      key += keyString.charCodeAt(i);
    }
  }
  return key;
}

/** Compute the resource suffix used by KanColle's SuffixUtil.create(no, key_string). */
export function calcShipGraphKey(id: number | string, keyString: string): string {
  const matcher = id.toString().match(/\d+/);
  if (matcher === null || matcher.length === 0) {
    return '';
  }
  const num = parseInt(matcher[0], 10);
  const key = createKey(keyString);
  const len = keyString != null && keyString.length > 0 ? keyString.length : 1;
  const suffix = ((((num + 7) * 17 * RESOURCE[(key + num * len) % 100]) % 8973) + 1000);
  return suffix.toString();
}

function normalizeDamaged(masterId: number, type: ShipGraphType, damaged: boolean): boolean {
  if (type === 'album_status') {
    return false;
  }
  if (DAMAGED_FORCE_TYPES.has(type)) {
    return true;
  }
  if (masterId > 1500 && !ENEMY_DAMAGED_EXCEPTIONS.has(masterId)) {
    return false;
  }
  return damaged;
}

function buildShipImageUrl(serverBase: string, path: string): string {
  return serverBase ? `${serverBase}${path}` : path;
}

/**
 * Build the official ship image path, following docs/shipimg.ts.
 *
 * KanColle's official URL format is:
 *   /kcs2/resources/ship/<dir>/<paddedId>_<suffix>.png
 *
 * `api_mst_shipgraph.api_filename` is not the suffix key; ship graphics use
 * `ship_${dir}` as the key string.
 */
export function getShipImagePath(
  masterId: number,
  type: ShipGraphType = 'banner',
  damaged: boolean = false,
): string {
  const normalizedDamaged = normalizeDamaged(masterId, type, damaged);
  const mapKey = `${masterId},${type},${normalizedDamaged}`;
  const cached = SHIP_IMAGE_PATH_CACHE.get(mapKey);
  if (cached) {
    return cached;
  }
  const paddedId = String(masterId).padStart(4, '0');
  const dir = `${type}${normalizedDamaged ? '_dmg' : ''}`;
  const key = calcShipGraphKey(masterId, `ship_${dir}`);
  const path = `/kcs2/resources/ship/${dir}/${paddedId}_${key}.png`;
  SHIP_IMAGE_PATH_CACHE.set(mapKey, path);
  return path;
}

/** Build the full URL for a ship image given the game server base. */
export function getShipImageUrl(
  masterId: number,
  serverBase: string,
  type: ShipGraphType = 'banner',
  damaged: boolean = false,
): string {
  return buildShipImageUrl(serverBase, getShipImagePath(masterId, type, damaged));
}

export function getShipBannerUrl(masterId: number, _filename: string, serverBase: string): string {
  return getShipImageUrl(masterId, serverBase, 'banner');
}

export function getShipCardUrl(masterId: number, _filename: string, serverBase: string): string {
  return getShipImageUrl(masterId, serverBase, 'card');
}

export function getShipRemodelUrl(masterId: number, serverBase: string, damaged: boolean = false): string {
  return getShipImageUrl(masterId, serverBase, 'remodel', damaged);
}

/** Extract the URL path component for a ship asset (used as cache key). */
export function getShipAssetPath(
  masterId: number,
  _filename: string,
  type: ShipGraphType = 'banner',
  damaged: boolean = false,
): string {
  return getShipImagePath(masterId, type, damaged);
}

/** Extract base URL (scheme + host) from a full URL string. */
export function extractServerBase(fullUrl: string): string | null {
  const m = fullUrl.match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : null;
}
