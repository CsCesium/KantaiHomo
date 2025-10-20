import hilog from '@ohos.hilog';
import { PersistDeps } from '../../../infra/deps';
import type { PersistEvent, PersistHandler } from './type';

const HILOG_DOM: number = 0x1357;

// 全局表：事件类型 -> handler
const REGISTRY: Map<string, PersistHandler> = new Map<string, PersistHandler>();

export function registerPersistHandler(type: string, h: PersistHandler): void {
  REGISTRY.set(type, h);
}

export function getPersistHandler(type: string): PersistHandler | undefined {
  return REGISTRY.get(type);
}

export function clearPersistHandlers(): void {
  REGISTRY.clear();
}

export function sizePersistHandlers(): number {
  return REGISTRY.size;
}

/**
 * 初始化注册表：
 */
let _inited = false;
export function initPersistRegistry(): void {
  if (_inited) return;
  _inited = true;
  hilog.info(HILOG_DOM, 'Persist', 'registry init, handlers=%{public}d', REGISTRY.size);
}

export async function dispatchPersistEvent(ev: PersistEvent, deps: PersistDeps): Promise<void> {
  const handler: PersistHandler | undefined = REGISTRY.get(ev.type);
  if (handler === undefined) return;
  await handler(ev, deps);
}
