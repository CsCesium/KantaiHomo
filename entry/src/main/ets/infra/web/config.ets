//declare const __DEV__: boolean;
import { buildProxyPermissionJson } from "./inject/perm";

export const HOME_URL: string =
   'http://www.dmm.com/netgame/social/-/gadgets/=/app_id=854854/'
  // 'https://www.dmm.com/netgame_s/...'

export const USER_AGENT: string | undefined =
   undefined ;                                 // 默认 UA
  // 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'

//NOTE:可能需要根据情况调整
/** JSProxy 权限 JSON */
//export const PERMISSION_JSON: string = buildProxyPermissionJson([]);
export const PERMISSION_JSON: string = '';


