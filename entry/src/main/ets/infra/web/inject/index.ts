import { defaultInjectOptions, InjectOptions } from '../types';
import { GUARDS } from './guards';
import { bridgeSnippet } from './modules/bridge';
import { hookXhrSnippet } from './modules/hookXHR';
import { hookFetchSnippet } from './modules/hookFetch';
import { fpsSnippet } from './modules/fps';
import { touchPatchSnippet } from './modules/touchPatch';
import { tickerRafSnippet } from './modules/tickerRaf';
import { pixiPatchSnippet } from './modules/pixiPatch';
import { iframeFitSnippet } from './modules/ifrFit';
import { sessionSnippet } from './modules/session';
import { promoteGameFrameSnippet } from './modules/promoteGameFrame';
import { postMessageGuardSnippet } from './modules/postMessageGuard';

function asEvalChunk(name: string, code: string): string {
  const escaped = code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${'); // 防止模板串插值
  return `;(0,eval)(\`${escaped}\n//# sourceURL=${name}\`);`;
}

export function buildInjectionBundle(opts?: InjectOptions): string {
  const o = { ...defaultInjectOptions, ...(opts || {}) };
  const out: string[] = [];
  out.push(GUARDS);
  out.push(asEvalChunk('hm-inject://postMessageGuard.js', postMessageGuardSnippet));
  out.push(asEvalChunk('hm-inject://bridge.js', bridgeSnippet(o.channelName, o.postMethod)));
  out.push(asEvalChunk('hm-inject://promote.js', promoteGameFrameSnippet));

  if (o.enableSessionPersist) out.push(asEvalChunk('hm-inject://session.js',   sessionSnippet));
  if (o.enableIframeFit)      {
    out.push(asEvalChunk('hm-inject://iframeFit.js', iframeFitSnippet));
  }

  if (o.enableXHRHook)    out.push(asEvalChunk('hm-inject://hookXHR.js',   hookXhrSnippet(o.channelName, o.postMethod, o.apiFilter)));
  if (o.enableFetchHook)  out.push(asEvalChunk('hm-inject://hookFetch.js', hookFetchSnippet(o.channelName, o.postMethod, o.apiFilter)));
  if (o.enableFPS)        out.push(asEvalChunk('hm-inject://fps.js',       fpsSnippet(o.channelName, o.postMethod)));
  if (o.enableTouchPatch) out.push(asEvalChunk('hm-inject://touchPatch.js',touchPatchSnippet));
  if (o.enableTickerRAF)  out.push(asEvalChunk('hm-inject://tickerRaf.js', tickerRafSnippet));
  if (o.enablePixiPatch)  out.push(asEvalChunk('hm-inject://pixiPatch.js', pixiPatchSnippet));

  out.push('//# sourceURL=hm-inject://loader.js');
  return out.join('\n');
}