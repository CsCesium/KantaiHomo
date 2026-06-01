export const APP_STORAGE_RESOURCE_CACHE_ENABLED = 'resourceCache.enabled';

export {
  clearResourceCache,
  initResourceCache,
  isCacheableGameAssetPath,
} from './assetCache';
export { gameAssetInterceptor } from './interceptor';
