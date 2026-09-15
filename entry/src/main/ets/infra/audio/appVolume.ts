import { audio } from '@kit.AudioKit';
import { kvGetNumber, kvGetString, kvSet } from '../storage/kv';

export const APP_STORAGE_APP_VOLUME_MUTED = 'audio.appVolume.muted';

const KV_APP_VOLUME_BEFORE_MUTE = 'audio.appVolume.beforeMute';
const DEFAULT_RESTORE_VOLUME = 100;
type AppVolumeMutedListener = (muted: boolean) => void;

const mutedListeners: AppVolumeMutedListener[] = [];
let initialization: Promise<void> | null = null;
let volumeTail: Promise<void> = Promise.resolve();
let changeVersion = 0;
let hasMutePreference = false;

function getAppAudioVolumeManager(): audio.AudioVolumeManager {
  return audio.getAudioManager().getVolumeManager();
}

function normalizeRestoreVolume(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return DEFAULT_RESTORE_VOLUME;
  return Math.min(100, Math.max(1, Math.round(volume)));
}

function setMutedStorage(muted: boolean): boolean {
  const prev = AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED);
  AppStorage.setOrCreate(APP_STORAGE_APP_VOLUME_MUTED, muted);
  AppStorage.set(APP_STORAGE_APP_VOLUME_MUTED, muted);
  if (prev !== muted) {
    mutedListeners.slice().forEach((listener: AppVolumeMutedListener) => {
      try {
        listener(muted);
      } catch (_e) {}
    });
  }
  return muted;
}

export function initAppVolumeMuteStorage(): void {
  if (AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED) === undefined) {
    AppStorage.setOrCreate(APP_STORAGE_APP_VOLUME_MUTED, false);
  }
  void restoreMutePreference();
}

function restoreMutePreference(): Promise<void> {
  if (initialization === null) {
    const version = changeVersion;
    initialization = (async () => {
      try {
        // An absent preference preserves the existing system-volume detection.
        const saved = await kvGetString(APP_STORAGE_APP_VOLUME_MUTED, '');
        if (version !== changeVersion || (saved !== 'true' && saved !== 'false')) return;
        hasMutePreference = true;
        const muted = saved === 'true';
        setMutedStorage(muted);
        await applyAppVolumeMuted(muted, false);
      } catch (e) {
        console.warn('[AppVolume] restore mute preference failed:', e);
      }
    })();
  }
  return initialization;
}

export function subscribeAppVolumeMuted(listener: AppVolumeMutedListener): () => void {
  mutedListeners.push(listener);
  return () => {
    const idx = mutedListeners.indexOf(listener);
    if (idx >= 0) {
      mutedListeners.splice(idx, 1);
    }
  };
}

export async function syncAppVolumeMuted(): Promise<boolean> {
  await restoreMutePreference();
  await volumeTail;
  const stored = AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED);
  if (hasMutePreference || stored === true) {
    return stored ?? false;
  }

  const version = changeVersion;
  try {
    const volume = await getAppAudioVolumeManager().getAppVolumePercentage();
    if (version !== changeVersion) return AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED) ?? false;
    return setMutedStorage(volume <= 0);
  } catch (_e) {
    return AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED) ?? false;
  }
}

export async function setAppVolumeMuted(muted: boolean): Promise<boolean> {
  const ready = restoreMutePreference();
  const version = ++changeVersion;
  hasMutePreference = true;
  setMutedStorage(muted);

  // Serialize persistence and native volume changes so rapid toggles keep the last choice.
  volumeTail = volumeTail.catch(() => undefined).then(async () => {
    await ready;
    if (version !== changeVersion) return;
    try {
      await kvSet(APP_STORAGE_APP_VOLUME_MUTED, muted);
    } catch (e) {
      console.warn('[AppVolume] save mute preference failed:', e);
    }
    if (version === changeVersion) await applyAppVolumeMuted(muted);
  });
  await volumeTail;
  return AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED) ?? muted;
}

async function applyAppVolumeMuted(muted: boolean, saveCurrentVolume: boolean = true): Promise<void> {
  try {
    const volumeManager = getAppAudioVolumeManager();
    const current = await volumeManager.getAppVolumePercentage();

    if (muted) {
      if (current > 0 && saveCurrentVolume) {
        try {
          await kvSet(KV_APP_VOLUME_BEFORE_MUTE, current);
        } catch (_e) {}
      }
      await volumeManager.setAppVolumePercentage(0);
      return;
    }

    // Do not overwrite a nonzero system volume when restoring an unmuted preference.
    if (current > 0) return;
    let saved: number = DEFAULT_RESTORE_VOLUME;
    try {
      saved = await kvGetNumber(KV_APP_VOLUME_BEFORE_MUTE, DEFAULT_RESTORE_VOLUME);
    } catch (_e) {}
    await volumeManager.setAppVolumePercentage(normalizeRestoreVolume(saved));
  } catch (_e) {
    // Some WebView audio paths are not controlled by app volume APIs. Keep the
    // requested mute state so WebHost can apply the in-page audio fallback.
  }
}
