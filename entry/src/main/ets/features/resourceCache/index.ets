export const APP_STORAGE_RESOURCE_CACHE_ENABLED = 'resourceCache.enabled';
export const APP_STORAGE_RESOURCE_CACHE_AUDIO = 'resourceCache.audio';

export {
  clearResourceCache,
  getResourceCacheStats,
  initResourceCache,
  isCacheableGameAssetPath,
} from './assetCache';
export type { ResourceCacheStats } from './assetCache';
export { gameAssetInterceptor } from './interceptor';
