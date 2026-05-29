import { audio } from '@kit.AudioKit';
import { kvGetNumber, kvSet } from '../storage/kv';

export const APP_STORAGE_APP_VOLUME_MUTED = 'audio.appVolume.muted';

const KV_APP_VOLUME_BEFORE_MUTE = 'audio.appVolume.beforeMute';
const DEFAULT_RESTORE_VOLUME = 100;
type AppVolumeMutedListener = (muted: boolean) => void;

const mutedListeners: AppVolumeMutedListener[] = [];

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
  AppStorage.setOrCreate(APP_STORAGE_APP_VOLUME_MUTED, false);
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
  const stored = AppStorage.get<boolean>(APP_STORAGE_APP_VOLUME_MUTED);
  if (stored === true) {
    return true;
  }

  try {
    const volume = await getAppAudioVolumeManager().getAppVolumePercentage();
    return setMutedStorage(volume <= 0);
  } catch (_e) {
    return setMutedStorage(stored ?? false);
  }
}

export async function setAppVolumeMuted(muted: boolean): Promise<boolean> {
  setMutedStorage(muted);

  try {
    const volumeManager = getAppAudioVolumeManager();

    if (muted) {
      const current = await volumeManager.getAppVolumePercentage();
      if (current > 0) {
        try {
          await kvSet(KV_APP_VOLUME_BEFORE_MUTE, current);
        } catch (_e) {}
      }
      await volumeManager.setAppVolumePercentage(0);
      return setMutedStorage(true);
    }

    let saved: number = DEFAULT_RESTORE_VOLUME;
    try {
      saved = await kvGetNumber(KV_APP_VOLUME_BEFORE_MUTE, DEFAULT_RESTORE_VOLUME);
    } catch (_e) {}
    await volumeManager.setAppVolumePercentage(normalizeRestoreVolume(saved));
  } catch (_e) {
    // Some WebView audio paths are not controlled by app volume APIs. Keep the
    // requested mute state so WebHost can apply the in-page audio fallback.
  }

  return setMutedStorage(muted);
}
