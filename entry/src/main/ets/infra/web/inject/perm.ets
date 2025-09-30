function entry(scheme: string, host: string): string {
  return '{"scheme":"' + scheme + '","host":"' + host + '","port":"","path":""}';
}

function listToJson(list: Array<string>): string {
  return list.join(',');
}

export const KCS_HOSTS: Array<string> = (() => {
  const out: Array<string> = [];
  for (let i = 1; i <= 40; i++) {
    const n = (i < 10 ? '0' + i : String(i));
    out.push('w' + n + 'o.kancolle-server.com');
  }
  return out;
})();

/** DMM 相关域 */
export const DMM_HOSTS: Array<string> = ['www.dmm.com', 'osapi.dmm.com'];

/** 生成 JSProxy 权限 JSON：为每个 host 同时生成 http/https 两条 */
export function buildProxyPermissionJson(extraHosts: Array<string>): string {
  const allowHosts: Array<string> = ([] as Array<string>)
    .concat(DMM_HOSTS)
    .concat(KCS_HOSTS)
    .concat(extraHosts);

  const httpList: Array<string> = [];
  const httpsList: Array<string> = [];
  for (let i = 0; i < allowHosts.length; i++) {
    const h: string = allowHosts[i];
    httpList.push(entry('http', h));
    httpsList.push(entry('https', h));
  }

  const urlPerm = listToJson(httpList.concat(httpsList));
  // 两个方法都绑定同一组 URL 权限
  const methodPost =
    '{"methodName":"post","urlPermissionList":[' + urlPerm + ']}';
  const methodPostAsync =
    '{"methodName":"postAsync","urlPermissionList":[' + urlPerm + ']}';

  const json =
    '{"javascriptProxyPermission":{' +
      '"urlPermissionList":[' + urlPerm + '],' +
      '"methodList":[' + methodPost + ',' + methodPostAsync + ']' +
      '}}';

  return json;
}