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
  | 'card'
  | 'full'
  | 'character_full'
  | 'character_up'
  | 'supply_character';



/** Compute the cipher key for a ship image file. */
export function calcShipGraphKey(masterId: number, filename: string): string {
  let s = 0;
  if (filename != null && filename !== '') {
    for (let i = 0; i < filename.length; i++) {
      s += filename.charCodeAt(i);
    }
  }

  const len = filename != null && filename.length > 0 ? filename.length : 1;
  const key = (((17 * (masterId + 7) * RESOURCE[(s + masterId * len) % 100]) % 8973) + 1000);
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
