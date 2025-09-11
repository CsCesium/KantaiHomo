//declare const __DEV__: boolean;

export const HOME_URL: string =
   'http://www.dmm.com/netgame/social/-/gadgets/=/app_id=854854/'
  // 'https://www.dmm.com/netgame_s/...'

export const USER_AGENT: string | undefined =
   undefined ;                                 // 默认 UA
  // 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'

//NOTE:可能需要根据情况调整
/** JSProxy 权限 JSON */
export const PERMISSION_JSON: string =
  '{"javascriptProxyPermission":{"urlPermissionList":[{"scheme":"https","host":"","port":"","path":""}],"methodList":[{"methodName":"post","urlPermissionList":[{"scheme":"https","host":"","port":"","path":""}]},{"methodName":"postAsync","urlPermissionList":[{"scheme":"https","host":"","port":"","path":""}]}]}}';
  // '{"javascriptProxyPermission":{"urlPermissionList":[{"scheme":"https","host":"www.dmm.com","port":"","path":""},{"scheme":"https","host":"ooi.moe","port":"","path":""}],"methodList":[{"methodName":"post","urlPermissionList":[{"scheme":"https","host":"www.dmm.com","port":"","path":""},{"scheme":"https","host":"ooi.moe","port":"","path":""}]},{"methodName":"postAsync","urlPermissionList":[{"scheme":"https","host":"www.dmm.com","port":"","path":""},{"scheme":"https","host":"ooi.moe","port":"","path":""}]}]}}';

