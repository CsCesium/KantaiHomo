import { url } from '@kit.ArkTS';
import {
  CachedAsset,
  isAudioAssetPath,
  isCacheableGameAssetPath,
  queueAssetDownload,
  recordResourceCacheHit,
  recordResourceCacheMiss,
  tryReadCachedAsset,
} from './assetCache';

export interface ResourceCacheInterceptOptions {
  enableAudio?: boolean;
}

interface ByteRange {
  start: number;
  end: number;
}

function appendCommonHeaders(headers: Array<Header>, asset: CachedAsset, contentLength: number): void {
  headers.push({ headerKey: 'Content-Type', headerValue: asset.mimeType });
  headers.push({ headerKey: 'Content-Length', headerValue: `${contentLength}` });
  headers.push({ headerKey: 'Accept-Ranges', headerValue: 'bytes' });
  headers.push({ headerKey: 'Cache-Control', headerValue: 'max-age=86400' });
}

function buildAssetResponse(asset: CachedAsset): WebResourceResponse {
  const resp = new WebResourceResponse();
  resp.setResponseCode(200);
  resp.setReasonMessage('OK');
  resp.setResponseMimeType(asset.mimeType);
  resp.setResponseData(asset.data);

  const headers = new Array<Header>();
  appendCommonHeaders(headers, asset, asset.data.byteLength);
  resp.setResponseHeader(headers);
  return resp;
}

function buildPartialAssetResponse(asset: CachedAsset, range: ByteRange): WebResourceResponse {
  const resp = new WebResourceResponse();
  const data = asset.data.slice(range.start, range.end + 1);
  resp.setResponseCode(206);
  resp.setReasonMessage('Partial Content');
  resp.setResponseMimeType(asset.mimeType);
  resp.setResponseData(data);

  const headers = new Array<Header>();
  appendCommonHeaders(headers, asset, data.byteLength);
  headers.push({
    headerKey: 'Content-Range',
    headerValue: `bytes ${range.start}-${range.end}/${asset.data.byteLength}`,
  });
  resp.setResponseHeader(headers);
  return resp;
}

function getRequestHeader(event: OnInterceptRequestEvent, key: string): string {
  try {
    const headers: Array<Header> = event.request.getRequestHeader();
    const needle = key.toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      const header: Header = headers[i];
      if (header.headerKey.toLowerCase() === needle) {
        return header.headerValue;
      }
    }
  } catch (_e) {
    // Missing request headers should fall back to normal network loading.
  }
  return '';
}

function parseByteRange(rangeHeader: string, totalSize: number): ByteRange | null {
  if (!rangeHeader || totalSize <= 0) return null;
  const normalized = rangeHeader.trim().toLowerCase();
  if (normalized.indexOf('bytes=') !== 0) return null;

  const spec = normalized.substring(6).trim();
  if (!spec || spec.indexOf(',') >= 0) return null;

  const dashIndex = spec.indexOf('-');
  if (dashIndex < 0) return null;

  const startText = spec.substring(0, dashIndex).trim();
  const endText = spec.substring(dashIndex + 1).trim();
  let start = 0;
  let end = totalSize - 1;

  if (!startText) {
    const suffixLength = parseInt(endText, 10);
    if (isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(totalSize - suffixLength, 0);
  } else {
    start = parseInt(startText, 10);
    if (isNaN(start) || start < 0 || start >= totalSize) return null;

    if (endText) {
      end = parseInt(endText, 10);
      if (isNaN(end) || end < start) return null;
      end = Math.min(end, totalSize - 1);
    }
  }

  return { start, end };
}

export function gameAssetInterceptor(
  event: OnInterceptRequestEvent,
  options: ResourceCacheInterceptOptions = {}
): WebResourceResponse | null {
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

  const enableAudio = options.enableAudio === true;
  if (!isCacheableGameAssetPath(urlPath, enableAudio)) return null;

  const cached = tryReadCachedAsset(urlPath, search);
  if (cached) {
    const rangeHeader = isAudioAssetPath(urlPath) ? getRequestHeader(event, 'Range') : '';
    if (rangeHeader) {
      const range = parseByteRange(rangeHeader, cached.data.byteLength);
      if (!range) return null;
      recordResourceCacheHit();
      return buildPartialAssetResponse(cached, range);
    }

    recordResourceCacheHit();
    return buildAssetResponse(cached);
  }

  recordResourceCacheMiss();
  queueAssetDownload(reqUrl, urlPath, search);
  return null;
}
