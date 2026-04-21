/**
 * ship graph cipher and URL builder.
 *
 */

//Tanaka's magic
const RESOURCE = [
  6, 5, 3, 1, 4, 2, 3, 8, 4, 2, 3, 2, 6, 1, 7, 7, 2, 9, 2, 6,
  4, 8, 4, 5, 6, 9, 8, 3, 4, 9, 7, 4, 6, 3, 1, 5, 6, 3, 6, 4,
  7, 3, 1, 3, 5, 2, 4, 6, 7, 8, 3, 2, 4, 9, 1, 3, 2, 4, 9, 6,
  8, 2, 4, 9, 3, 4, 2, 1, 3, 6, 5, 4, 6, 8, 3, 2, 4, 3, 6, 9,
  5, 4, 3, 7, 4, 9, 8, 7, 3, 2, 7, 4, 3, 9, 2, 4, 8, 2, 4, 6,
];

export type ShipGraphType =
  | 'banner'
  | 'card'
  | 'full'
  | 'character_full'
  | 'character_up'
  | 'supply_character';

/** Compute the cipher key for a ship image file. */
export function calcShipGraphKey(masterId: number, filename: string): string {
  let s = 0;
  for (let i = 0; i < filename.length; i++) {
    s += filename.charCodeAt(i);
  }
  const key = (((17 * (masterId + 7) * RESOURCE[(s + masterId * 5) % 100]) % 8973) + 1000);
  return key.toString();
}

/** Build the full URL for a ship image given the game server base. */
export function getShipImageUrl(
  masterId: number,
  filename: string,
  serverBase: string,
  type: ShipGraphType = 'banner',
): string {
  const paddedId = String(masterId).padStart(4, '0');
  const key = calcShipGraphKey(masterId, filename);
  return `${serverBase}/kcs2/resources/ship/${type}/${paddedId}_${key}.png`;
}

export function getShipBannerUrl(masterId: number, filename: string, serverBase: string): string {
  return getShipImageUrl(masterId, filename, serverBase, 'banner');
}

export function getShipCardUrl(masterId: number, filename: string, serverBase: string): string {
  return getShipImageUrl(masterId, filename, serverBase, 'card');
}

/** Extract the URL path component for a ship asset (used as cache key). */
export function getShipAssetPath(masterId: number, filename: string, type: ShipGraphType = 'banner'): string {
  const paddedId = String(masterId).padStart(4, '0');
  const key = calcShipGraphKey(masterId, filename);
  return `/kcs2/resources/ship/${type}/${paddedId}_${key}.png`;
}

/** Extract base URL (scheme + host) from a full URL string. */
export function extractServerBase(fullUrl: string): string | null {
  const m = fullUrl.match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : null;
}
