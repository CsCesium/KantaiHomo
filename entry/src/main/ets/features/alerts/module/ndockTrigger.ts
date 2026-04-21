/**
 * Ndock trigger bridge — pure TS.
 *
 * Allows the .ts handler layer to fire side-effects (scheduler poke, etc.)
 * implemented in the .ets platform layer.
 *
 * Usage:
 *   .ets init code  → addOnNdockChanged(cb)  returns an unsubscribe fn
 *   .ts  handler    → triggerNdockChanged()
 */

type VoidCb = () => void;

const _listeners: VoidCb[] = [];

/**
 * Register a callback to be called whenever ndock state changes in the DB.
 * Returns an unsubscribe function.
 */
export function addOnNdockChanged(cb: VoidCb): () => void {
  _listeners.push(cb);
  return () => {
    const idx = _listeners.indexOf(cb);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

export function triggerNdockChanged(): void {
  for (const cb of _listeners) {
    try { cb(); } catch (e) {
      console.warn('[NdockTrigger] listener error:', e);
    }
  }
}
