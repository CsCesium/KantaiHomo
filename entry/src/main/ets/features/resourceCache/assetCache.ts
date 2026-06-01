/**
 * Local cache for game static assets.
 *
 * Phase 1 intentionally caches image resources only. Audio often uses Range
 * requests; serving it safely needs 206 Partial Content support.
 */
import fs from '@ohos.file.fs';
import http from '@ohos.net.http';

const CACHE_DIR_NAME = 'kcs2_cache';
const GAME_RESOURCE_PREFIX = '/kcs2/resources/';

let cacheBase: string | null = null;
const pendingDownloads: Set<string> = new Set();

export interface CachedAsset {
  data: Uint8Array;
  mimeType: string;
}

export function initResourceCache(filesDir: string): void {
  cacheBase = `${filesDir}/${CACHE_DIR_NAME}`;
}

function normalizePath(urlPath: string): string {
  return urlPath.replace(/\.\./g, '').replace(/^\/+/, '').replace(/[\\:*?"<>|]/g, '_');
}

function normalizeSearch(search: string): string {
  if (!search) return '';
  return `__q_${search.replace(/[^A-Za-z0-9._=-]/g, '_')}`;
}

function toCachePath(urlPath: string, search: string = ''): string | null {
  if (!cacheBase) return null;
  const safePath = normalizePath(urlPath);
  if (!safePath) return null;
  return `${cacheBase}/${safePath}${normalizeSearch(search)}`;
}

function ensureDirs(filePath: string): void {
  const index = filePath.lastIndexOf('/');
  if (index <= 0) return;
  const dir = filePath.substring(0, index);
  try { fs.mkdirSync(dir); } catch (_e) { /* may already exist */ }
}

function fileExists(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 0;
  } catch (_e) {
    return false;
  }
}

export function mimeTypeForPath(urlPath: string): string {
  const lower = urlPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export function isImageAssetPath(urlPath: string): boolean {
  const lower = urlPath.toLowerCase();
  return lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp');
}

export function isCacheableGameAssetPath(urlPath: string): boolean {
  return urlPath.indexOf(GAME_RESOURCE_PREFIX) >= 0 && isImageAssetPath(urlPath);
}

export function tryReadCachedAsset(urlPath: string, search: string = ''): CachedAsset | null {
  const cachePath = toCachePath(urlPath, search);
  if (!cachePath) return null;
  try {
    const stat = fs.statSync(cachePath);
    if (stat.size <= 0) return null;
    const file = fs.openSync(cachePath, fs.OpenMode.READ_ONLY);
    try {
      const buf = new ArrayBuffer(stat.size);
      fs.readSync(file.fd, buf);
      return {
        data: new Uint8Array(buf),
        mimeType: mimeTypeForPath(urlPath),
      };
    } finally {
      fs.closeSync(file.fd);
    }
  } catch (_e) {
    return null;
  }
}

export function queueAssetDownload(fullUrl: string, urlPath: string, search: string = ''): void {
  const cachePath = toCachePath(urlPath, search);
  if (!cachePath) return;
  if (fileExists(cachePath)) return;
  if (pendingDownloads.has(cachePath)) return;

  pendingDownloads.add(cachePath);
  (async () => {
    const req = http.createHttp();
    const tmpPath = `${cachePath}.tmp`;
    try {
      const resp = await req.request(fullUrl, {
        method: http.RequestMethod.GET,
        expectDataType: http.HttpDataType.ARRAY_BUFFER,
      });
      if (resp.responseCode !== 200) return;
      const data = resp.result as ArrayBuffer;
      if (!data || data.byteLength === 0) return;

      ensureDirs(cachePath);
      const file = fs.openSync(tmpPath, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      try {
        fs.writeSync(file.fd, data);
      } finally {
        fs.closeSync(file.fd);
      }
      fs.renameSync(tmpPath, cachePath);
    } catch (_e) {
      // Cache failures must never affect game loading.
    } finally {
      pendingDownloads.delete(cachePath);
      req.destroy();
    }
  })();
}

function deletePath(path: string): void {
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(path).isDirectory();
  } catch (_e) {
    return;
  }

  if (isDirectory) {
    const children = fs.listFileSync(path);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childPath = child.indexOf('/') >= 0 ? child : `${path}/${child}`;
      deletePath(childPath);
    }
    try { fs.rmdirSync(path); } catch (_e) {}
    return;
  }

  try { fs.unlinkSync(path); } catch (_e) {}
}

export async function clearResourceCache(): Promise<void> {
  if (!cacheBase) return;
  pendingDownloads.clear();
  deletePath(cacheBase);
}
