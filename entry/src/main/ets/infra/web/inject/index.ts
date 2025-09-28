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

function asEvalChunk(name: string, code: string): string {
  const escaped = code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${'); // 防止模板串插值
  return `;(0,eval)(\`${escaped}\n//# sourceURL=${name}\`);`;
}

function asInjectChunk(name: string, code: string): string {
  const escaped = code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

  return `
(function(){
  var __name = '${name}';
  var __code = \`${escaped}\n//# sourceURL=${name}\`;
  try {
    // 尝试在 Main world 通过 <script> 注入
    var s = document.createElement('script');
    s.type = 'text/javascript';

    // 尝试继承页面已存在的 nonce（若 CSP 需要）
    try {
      var ex = document.querySelector('script[nonce]');
      var n = ex ? (ex.getAttribute('nonce') || (ex.nonce || '')) : '';
      if (n) { s.setAttribute('nonce', n); try { s.nonce = n; } catch(e){} }
    } catch(_) {}

    // 用 textNode 设置脚本内容，避免 </script> 解析问题
    s.appendChild(document.createTextNode(__code));

    var root = document.documentElement || document.head || document.body;
    if (!root) throw new Error('no DOM root');
    root.appendChild(s);
    if (s.parentNode) s.parentNode.removeChild(s);

    console.log('[inject] main-world ok:', __name);
  } catch (e) {
    // 回退：仍保留 sourceURL 方便调试
    try { console.warn('[inject] main-world failed, fallback to eval:', __name, e); } catch(_){}
    (0, eval)(__code);
  }
})();`;
}

export function buildInjectionBundle(opts?: InjectOptions): string {
  const o = { ...defaultInjectOptions, ...(opts || {}) };
  const out: string[] = [];
  out.push(GUARDS);
  out.push(asInjectChunk('hm-inject://bridge.js', bridgeSnippet(o.channelName, o.postMethod)));

  if (o.enableSessionPersist) out.push(asInjectChunk('hm-inject://session.js',   sessionSnippet));
  if (o.enableIframeFit)      {
    out.push(asInjectChunk('hm-inject://iframeFit.js', iframeFitSnippet));
  }

  if (o.enableXHRHook)    out.push(asInjectChunk('hm-inject://hookXHR.js',   hookXhrSnippet(o.channelName, o.postMethod, o.apiFilter)));
  if (o.enableFetchHook)  out.push(asInjectChunk('hm-inject://hookFetch.js', hookFetchSnippet(o.channelName, o.postMethod, o.apiFilter)));
  if (o.enableFPS)        out.push(asInjectChunk('hm-inject://fps.js',       fpsSnippet(o.channelName, o.postMethod)));
  if (o.enableTouchPatch) out.push(asInjectChunk('hm-inject://touchPatch.js',touchPatchSnippet));
  if (o.enableTickerRAF)  out.push(asInjectChunk('hm-inject://tickerRaf.js', tickerRafSnippet));
  if (o.enablePixiPatch)  out.push(asInjectChunk('hm-inject://pixiPatch.js', pixiPatchSnippet));

  out.push('//# sourceURL=hm-inject://loader.js');
  return out.join('\n');
}