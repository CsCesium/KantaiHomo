/**
 * Ship graph image cache — synchronous read for WebView interceptor,
 * async write via background HTTP download.
 *
 * Cache layout: <filesDir>/kcs2_cache/<path>.png
 * where <path> matches the URL path, e.g. /kcs2/resources/ship/banner/0001_5834.png
 */
import fs from '@ohos.file.fs';
import http from '@ohos.net.http';

let _cacheBase: string | null = null;

/** Call once at app start with context.filesDir */
export function initShipGraphCache(filesDir: string): void {
  _cacheBase = `${filesDir}/kcs2_cache`;
}

/** Map URL path like "/kcs2/resources/ship/banner/0001_5834.png" to local file path. */
function toCachePath(urlPath: string): string | null {
  if (!_cacheBase) return null;
  // Sanitise: strip leading slash, disallow directory traversal
  const safe = urlPath.replace(/\.\./g, '').replace(/^\/+/, '');
  return `${_cacheBase}/${safe}`;
}

/** Synchronously check and read a cached ship image. Returns null on miss. */
export function tryServeCached(urlPath: string): Uint8Array | null {
  const cachePath = toCachePath(urlPath);
  if (!cachePath) return null;
  try {
    const stat = fs.statSync(cachePath);
    if (stat.size <= 0) return null;
    const file = fs.openSync(cachePath, fs.OpenMode.READ_ONLY);
    try {
      const buf = new ArrayBuffer(stat.size);
      fs.readSync(file.fd, buf);
      return new Uint8Array(buf);
    } finally {
      fs.closeSync(file.fd);
    }
  } catch (_e) {
    return null;
  }
}

/** Ensure all directories in the path exist. */
function ensureDirs(filePath: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  try { fs.mkdirSync(dir); } catch (_e) { /* may already exist */ }
}

/** Download a game asset and write it to the local cache (fire-and-forget). */
export function queueDownload(fullUrl: string, urlPath: string): void {
  const cachePath = toCachePath(urlPath);
  if (!cachePath) return;
  // Don't re-download if already exists
  try { fs.statSync(cachePath); return; } catch (_e) { /* not cached */ }

  (async () => {
    const req = http.createHttp();
    try {
      const resp = await req.request(fullUrl, {
        method: http.RequestMethod.GET,
        expectDataType: http.HttpDataType.ARRAY_BUFFER,
      });
      if (resp.responseCode !== 200) return;
      const data = resp.result as ArrayBuffer;
      if (!data || data.byteLength === 0) return;
      ensureDirs(cachePath);
      const file = fs.openSync(cachePath, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      try {
        fs.writeSync(file.fd, data);
      } finally {
        fs.closeSync(file.fd);
      }
    } catch (_e) {
      // Silently ignore download failures
    } finally {
      req.destroy();
    }
  })();
}

/** Return true if an asset URL path looks like a ship image we should cache. */
export function isShipAssetPath(urlPath: string): boolean {
  return urlPath.includes('/kcs2/resources/ship/');
}
