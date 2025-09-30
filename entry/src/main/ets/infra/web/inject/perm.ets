function ent(scheme: string, host: string, path: string): string {
  return '{"scheme":"' + scheme + '","host":"' + host + '","port":"","path":"' + path + '"}';
}

function join(list: Array<string>): string {
  return list.join(',');
}

export const KCS_HOSTS: Array<string> = (() => {
  const out: Array<string> = [];
  for (let i = 1; i <= 10; i++) {
    const n: string = (i < 10 ? '0' + i : String(i));
    out.push('w' + n + 'o.kancolle-server.com');
  }
  return out;
})();

/** DMM 相关域 */
export const DMM_HOSTS: Array<string> = ['www.dmm.com', 'osapi.dmm.com'];

export function buildProxyPermissionJson(extraHosts: Array<string>): string {
  const allowHosts: Array<string> = ([] as Array<string>)
    .concat(DMM_HOSTS)
    .concat(KCS_HOSTS)
    .concat(extraHosts);

  const urlAll: Array<string> = [];
  for (let i = 0; i < allowHosts.length; i++) {
    const h: string = allowHosts[i];
    urlAll.push(ent('http', h, ''));
    urlAll.push(ent('https', h, ''));
  }
  const urlPermAll: string = join(urlAll);

  const mPost: string      = '{"methodName":"post","urlPermissionList":[' + urlPermAll + ']}';
  const mPostAsync: string = '{"methodName":"postAsync","urlPermissionList":[' + urlPermAll + ']}';

  const json: string =
    '{"javascriptProxyPermission":{' +
      '"urlPermissionList":[' + urlPermAll + '],' +
      '"methodList":[' + mPost + ',' + mPostAsync + ']' +
      '}}';

  return json;
}