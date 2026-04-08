/**
 * Expedition trigger bridge — pure TS.
 *
 * Allows the .ts handler layer to fire side-effects (scheduler poke +
 * live-notification refresh) that are implemented in the .ets platform layer.
 *
 * Usage:
 *   .ets init code  → registerOnExpeditionChanged(cb)
 *   .ts  handler    → triggerExpeditionChanged()
 */

type VoidCb = () => void;

let _onChanged: VoidCb | null = null;

export function registerOnExpeditionChanged(cb: VoidCb): void {
  _onChanged = cb;
}

export function triggerExpeditionChanged(): void {
  _onChanged?.();
}
