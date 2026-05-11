const SHIP_AVATAR_DIR = 'resource://RAWFILE/ship/avatar/';

/** Returns the packaged square avatar image path for a ship master id. */
export function getShipAvatarPath(masterId: number): string {
  return masterId > 0 ? `${SHIP_AVATAR_DIR}${masterId}.png` : '';
}
