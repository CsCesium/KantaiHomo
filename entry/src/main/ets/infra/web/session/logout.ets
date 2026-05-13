import { webview } from '@kit.ArkWeb';
import { promptAction } from '@kit.ArkUI';
import { kvDelete } from '../../storage/kv';

const DMM_COOKIE_BACKUP_KEY = 'dmm.cookie.backup.v1';
export const APP_STORAGE_SESSION_LOGOUT_REV = 'session.logout.rev';

function notifySessionLogout(): void {
  const current = AppStorage.get<number>(APP_STORAGE_SESSION_LOGOUT_REV) ?? 0;
  AppStorage.setOrCreate(APP_STORAGE_SESSION_LOGOUT_REV, current + 1);
  AppStorage.set(APP_STORAGE_SESSION_LOGOUT_REV, current + 1);
}

export function logoutGameSession(): void {
  webview.WebCookieManager.clearAllCookiesSync();
  void kvDelete(DMM_COOKIE_BACKUP_KEY);
  notifySessionLogout();
}

export function promptLogout(): void {
  promptAction.showDialog({
    title: '确认登出',
    message: '将清除登录 Cookie 及页面缓存。下次进入游戏会回到登录页。',
    buttons: [
      { text: '取消', color: '#888888' },
      { text: '确认登出', color: '#e53935' },
    ],
  }).then((result) => {
    if (result.index === 1) {
      logoutGameSession();
    }
  }).catch((_e: Error) => {});
}
