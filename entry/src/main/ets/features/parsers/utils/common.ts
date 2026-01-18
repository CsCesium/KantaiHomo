import url from '@ohos.url';

export function parseSvdata<T=any>(text: string): T | null {
  if (text && typeof text === 'object') return text;
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

export function extractKcsApiObject(dump: any): any | null {
  const raw =
    dump?.data ??
      dump?.responseBody ??
      dump?.body ??
      dump?.text ??
      dump?.resp ??
      dump?.responseText

  const obj = parseSvdata(raw)
  if (!obj) return null

  // 常见结构：{ api_result, api_result_msg, api_data }
  if (obj.api_data != null) return obj

  // 有些封装可能是 { data: { api_result... } }
  if (obj.data && obj.data.api_data != null) return obj.data

  return obj
}

export function safeArr(v: any): any[] {
  return Array.isArray(v) ? v : []
}
