import url from '@ohos.url';

export function parseSvdata<T=any>(text: string): T | null {
  try {
    const s = text.startsWith('svdata=') ? text.slice(7) : text;
    return JSON.parse(s);
  } catch { return null; }
}

export function parseFormBody(body: string | undefined | null): url.URLParams {
  return new url.URLParams(body ?? '');
}

export function makeEventId(parts: Array<string | number>): string {
  //TODO: 替换为hash
  return parts.join('|');
}