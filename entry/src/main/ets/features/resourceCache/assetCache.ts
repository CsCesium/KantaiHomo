/**
 * Local cache for game static assets.
 *
 * Image resources are enabled by the main feature switch. Audio resources are
 * gated behind a separate experimental switch because playback often depends
 * on Range requests.
 */
import fs from '@ohos.file.fs';
import http from '@ohos.net.http';

const CACHE_DIR_NAME = 'kcs2_cache';
const GAME_RESOURCE_PREFIX = '/kcs2/resources/';

let cacheBase: string | null = null;
const pendingDownloads: Set<string> = new Set();
const sessionStats: ResourceCacheSessionStats = {
  hitCount: 0,
  missCount: 0,
  downloadQueuedCount: 0,
  downloadSuccessCount: 0,
  downloadFailCount: 0,
};

export interface CachedAsset {
  data: ArrayBuffer;
  mimeType: string;
}

export interface ResourceCacheSessionStats {
  hitCount: number;
  missCount: number;
  downloadQueuedCount: number;
  downloadSuccessCount: number;
  downloadFailCount: number;
}

export interface ResourceCacheStats extends ResourceCacheSessionStats {
  ready: boolean;
  fileCount: number;
  totalBytes: number;
  pendingDownloadCount: number;
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
  try { fs.mkdirSync(dir, true); } catch (_e) { /* may already exist */ }
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
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
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

export function isAudioAssetPath(urlPath: string): boolean {
  const lower = urlPath.toLowerCase();
  return lower.endsWith('.mp3') ||
    lower.endsWith('.m4a') ||
    lower.endsWith('.aac') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.wav');
}

export function isCacheableGameAssetPath(urlPath: string, enableAudio: boolean = false): boolean {
  if (urlPath.indexOf(GAME_RESOURCE_PREFIX) < 0) return false;
  if (isImageAssetPath(urlPath)) return true;
  return enableAudio && isAudioAssetPath(urlPath);
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
        data: buf,
        mimeType: mimeTypeForPath(urlPath),
      };
    } finally {
      fs.closeSync(file.fd);
    }
  } catch (_e) {
    return null;
  }
}

export function recordResourceCacheHit(): void {
  sessionStats.hitCount++;
}

export function recordResourceCacheMiss(): void {
  sessionStats.missCount++;
}

export function queueAssetDownload(fullUrl: string, urlPath: string, search: string = ''): void {
  const cachePath = toCachePath(urlPath, search);
  if (!cachePath) return;
  if (fileExists(cachePath)) return;
  if (pendingDownloads.has(cachePath)) return;

  pendingDownloads.add(cachePath);
  sessionStats.downloadQueuedCount++;
  (async () => {
    const req = http.createHttp();
    const tmpPath = `${cachePath}.tmp`;
    let saved = false;
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
      saved = true;
    } catch (_e) {
      // Cache failures must never affect game loading.
      console.debug(_e)
    } finally {
      if (saved) {
        sessionStats.downloadSuccessCount++;
      } else {
        sessionStats.downloadFailCount++;
      }
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

function resetSessionStats(): void {
  sessionStats.hitCount = 0;
  sessionStats.missCount = 0;
  sessionStats.downloadQueuedCount = 0;
  sessionStats.downloadSuccessCount = 0;
  sessionStats.downloadFailCount = 0;
}

function collectDiskStats(path: string): { fileCount: number; totalBytes: number } {
  let isDirectory = false;
  let size = 0;
  try {
    const stat = fs.statSync(path);
    isDirectory = stat.isDirectory();
    size = stat.size;
  } catch (_e) {
    return { fileCount: 0, totalBytes: 0 };
  }

  if (!isDirectory) {
    if (path.endsWith('.tmp')) {
      return { fileCount: 0, totalBytes: 0 };
    }
    return { fileCount: 1, totalBytes: size };
  }

  const total = { fileCount: 0, totalBytes: 0 };
  let children: string[] = [];
  try {
    children = fs.listFileSync(path);
  } catch (_e) {
    return total;
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childPath = child.indexOf('/') >= 0 ? child : `${path}/${child}`;
    const childStats = collectDiskStats(childPath);
    total.fileCount += childStats.fileCount;
    total.totalBytes += childStats.totalBytes;
  }
  return total;
}

export async function getResourceCacheStats(): Promise<ResourceCacheStats> {
  const diskStats = cacheBase ? collectDiskStats(cacheBase) : { fileCount: 0, totalBytes: 0 };
  return {
    ready: cacheBase !== null,
    fileCount: diskStats.fileCount,
    totalBytes: diskStats.totalBytes,
    pendingDownloadCount: pendingDownloads.size,
    hitCount: sessionStats.hitCount,
    missCount: sessionStats.missCount,
    downloadQueuedCount: sessionStats.downloadQueuedCount,
    downloadSuccessCount: sessionStats.downloadSuccessCount,
    downloadFailCount: sessionStats.downloadFailCount,
  };
}

export async function clearResourceCache(): Promise<void> {
  if (!cacheBase) return;
  pendingDownloads.clear();
  deletePath(cacheBase);
  resetSessionStats();
}
