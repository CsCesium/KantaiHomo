declare const __DEV__: boolean;

export const HOME_URL: string = __DEV__
  ? 'https://www.dmm.com'                 // 开发调试入口
  : 'https://www.dmm.com/netgame_s/...'       // 上线入口

export const USER_AGENT: string | undefined = __DEV__
  ? undefined                                  // 默认 UA
  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36';

//NOTE:可能需要根据情况调整
/** JSProxy 权限 JSON */
export const PERMISSION_JSON: string = __DEV__
  ? '{"javascriptProxyPermission":{"urlPermissionList":[{"scheme":"https","host":"","port":"","path":""}],"methodList":[{"methodName":"post","urlPermissionList":[{"scheme":"https","host":"","port":"","path":""}]},{"methodName":"postAsync","urlPermissionList":[{"scheme":"https","host":"","port":"","path":""}]}]}}'
  : '{"javascriptProxyPermission":{"urlPermissionList":[{"scheme":"https","host":"www.dmm.com","port":"","path":""},{"scheme":"https","host":"ooi.moe","port":"","path":""}],"methodList":[{"methodName":"post","urlPermissionList":[{"scheme":"https","host":"www.dmm.com","port":"","path":""},{"scheme":"https","host":"ooi.moe","port":"","path":""}]},{"methodName":"postAsync","urlPermissionList":[{"scheme":"https","host":"www.dmm.com","port":"","path":""},{"scheme":"https","host":"ooi.moe","port":"","path":""}]}]}}';

