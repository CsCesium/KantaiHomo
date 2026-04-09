/**
 * Expedition trigger bridge — pure TS.
 *
 * Allows the .ts handler layer to fire side-effects (scheduler poke,
 * live-notification refresh, etc.) implemented in the .ets platform layer.
 *
 * Supports multiple independent listeners so that scheduler-poke and
 * notification-refresh can be registered separately and independently
 * of notification permission state.
 *
 * Usage:
 *   .ets init code  → addOnExpeditionChanged(cb)  returns an unsubscribe fn
 *   .ts  handler    → triggerExpeditionChanged()
 */

type VoidCb = () => void;

const _listeners: VoidCb[] = [];

/**
 * Register a callback to be called whenever expedition state changes in the DB.
 * Returns an unsubscribe function.
 */
export function addOnExpeditionChanged(cb: VoidCb): () => void {
  _listeners.push(cb);
  return () => {
    const idx = _listeners.indexOf(cb);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

/** @deprecated use addOnExpeditionChanged */
export function registerOnExpeditionChanged(cb: VoidCb): void {
  addOnExpeditionChanged(cb);
}

export function triggerExpeditionChanged(): void {
  for (const cb of _listeners) {
    try { cb(); } catch (e) {
      console.warn('[ExpeditionTrigger] listener error:', e);
    }
  }
}
