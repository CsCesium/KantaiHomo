import { url } from '@kit.ArkTS';
import {
  CachedAsset,
  isCacheableGameAssetPath,
  queueAssetDownload,
  recordResourceCacheHit,
  recordResourceCacheMiss,
  tryReadCachedAsset,
} from './assetCache';

function buildAssetResponse(asset: CachedAsset): WebResourceResponse {
  const resp = new WebResourceResponse();
  resp.setResponseCode(200);
  resp.setReasonMessage('OK');
  resp.setResponseMimeType(asset.mimeType);
  resp.setResponseEncoding('utf-8');
  resp.setResponseData(asset.data);

  const headers = new Array<Header>();
  headers.push({ headerKey: 'Content-Type', headerValue: asset.mimeType });
  headers.push({ headerKey: 'Cache-Control', headerValue: 'max-age=86400' });
  resp.setResponseHeader(headers);
  return resp;
}

export function gameAssetInterceptor(event: OnInterceptRequestEvent): WebResourceResponse | null {
  if (!event?.request) return null;
  const method: string = event.request.getRequestMethod();
  if (method !== 'GET') return null;

  const reqUrl: string = event.request.getRequestUrl();
  if (!reqUrl) return null;

  let urlPath: string;
  let search: string;
  try {
    const parsed = url.URL.parseURL(reqUrl);
    urlPath = parsed.pathname;
    search = parsed.search;
  } catch (_e) {
    return null;
  }

  if (!isCacheableGameAssetPath(urlPath)) return null;

  const cached = tryReadCachedAsset(urlPath, search);
  if (cached) {
    recordResourceCacheHit();
    return buildAssetResponse(cached);
  }

  recordResourceCacheMiss();
  queueAssetDownload(reqUrl, urlPath, search);
  return null;
}
