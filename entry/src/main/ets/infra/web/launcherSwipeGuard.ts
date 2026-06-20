const APP_STORAGE_LAUNCHER_SWIPE_BLOCKED: string = 'webhost.launcherSwipe.blocked';

export function setLauncherSwipeBlocked(blocked: boolean): void {
  const prev = AppStorage.get<boolean>(APP_STORAGE_LAUNCHER_SWIPE_BLOCKED);
  if (prev === blocked) {
    return;
  }
  AppStorage.setOrCreate(APP_STORAGE_LAUNCHER_SWIPE_BLOCKED, blocked);
  AppStorage.set(APP_STORAGE_LAUNCHER_SWIPE_BLOCKED, blocked);
}

export function isLauncherSwipeBlocked(): boolean {
  return AppStorage.get<boolean>(APP_STORAGE_LAUNCHER_SWIPE_BLOCKED) ?? false;
}
