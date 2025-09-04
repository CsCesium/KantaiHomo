import { defaultInjectOptions, InjectOptions } from '../types';
import { GUARDS } from './guards';
import { bridgeSnippet } from './modules/bridge';
import { hookXhrSnippet } from './modules/hookXHR';
import { hookFetchSnippet } from './modules/hookFetch';
import { fpsSnippet } from './modules/fps';
import { touchPatchSnippet } from './modules/touchPatch';
import { tickerRafSnippet } from './modules/tickerRaf';
import { pixiPatchSnippet } from './modules/pixiPatch';

export function buildInjectionBundle(opts?: InjectOptions): string {
  const o = { ...defaultInjectOptions, ...(opts || {}) };
  const out: string[] = [];
  out.push(GUARDS);

  out.push(bridgeSnippet(o.channelName, o.postMethod));

  if (o.enableXHRHook)   out.push(hookXhrSnippet(o.channelName, o.postMethod, o.apiFilter));
  if (o.enableFetchHook) out.push(hookFetchSnippet(o.channelName, o.postMethod, o.apiFilter));
  if (o.enableFPS)       out.push(fpsSnippet(o.channelName, o.postMethod));
  if (o.enableTouchPatch)out.push(touchPatchSnippet);
  if (o.enableTickerRAF) out.push(tickerRafSnippet);
  if (o.enablePixiPatch) out.push(pixiPatchSnippet);

  // debugging sourceURL（在 DevTools 的 Sources 里能看到虚拟文件名）
  out.push('//# sourceURL=inject-bundle.js');
  return out.join('\n');
}