import { audio } from '@kit.AudioKit';
import { kvGetNumber, kvSet } from '../storage/kv';

export const APP_STORAGE_APP_VOLUME_MUTED = 'audio.appVolume.muted';

const KV_APP_VOLUME_BEFORE_MUTE = 'audio.appVolume.beforeMute';
const DEFAULT_RESTORE_VOLUME = 100;

function getAppAudioVolumeManager(): audio.AudioVolumeManager {
  return audio.getAudioManager().getVolumeManager();
}

function normalizeRestoreVolume(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return DEFAULT_RESTORE_VOLUME;
  return Math.min(100, Math.max(1, Math.round(volume)));
}

function setMutedStorage(muted: boolean): boolean {
  AppStorage.setOrCreate(APP_STORAGE_APP_VOLUME_MUTED, muted);
  AppStorage.set(APP_STORAGE_APP_VOLUME_MUTED, muted);
  return muted;
}

export function initAppVolumeMuteStorage(): void {
  AppStorage.setOrCreate(APP_STORAGE_APP_VOLUME_MUTED, false);
}

export async function syncAppVolumeMuted(): Promise<boolean> {
  const volume = await getAppAudioVolumeManager().getAppVolumePercentage();
  return setMutedStorage(volume <= 0);
}

export async function setAppVolumeMuted(muted: boolean): Promise<boolean> {
  const volumeManager = getAppAudioVolumeManager();

  if (muted) {
    const current = await volumeManager.getAppVolumePercentage();
    if (current > 0) {
      await kvSet(KV_APP_VOLUME_BEFORE_MUTE, current);
    }
    await volumeManager.setAppVolumePercentage(0);
    return setMutedStorage(true);
  }

  const saved = await kvGetNumber(KV_APP_VOLUME_BEFORE_MUTE, DEFAULT_RESTORE_VOLUME);
  await volumeManager.setAppVolumePercentage(normalizeRestoreVolume(saved));
  return setMutedStorage(false);
}
