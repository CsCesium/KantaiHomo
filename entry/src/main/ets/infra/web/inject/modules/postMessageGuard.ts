// entry/src/main/ets/infra/web/inject/modules/postMessageGuard.ts
export const postMessageGuardSnippet: string = `
(function(){
  // 只在顶层 kcs2 页启用
  var isKcsTop = /\\/kcs2\\//i.test(location.href) && /kancolle-server\\.com$/i.test(location.hostname);
  if (!isKcsTop) return;

  function wrap(fn){
    return function patchedPostMessage(message, targetOrigin, transfer){
      try {
        if (typeof targetOrigin === 'string' && /osapi\\.dmm\\.com/i.test(targetOrigin)) {
          // 将目标放宽，避免抛错打断游戏初始化
          // 也可替换为: targetOrigin = location.origin;
          targetOrigin = '*';
        }
        return fn.call(this, message, targetOrigin, transfer);
      } catch (e) {
        // 再兜一层，确保不会因为 origin 不匹配而中断
        var msg = (e && e.message) || '';
        if (msg.indexOf('postMessage') !== -1) {
          try { return fn.call(this, message, '*', transfer); } catch (_) { return; }
        }
        throw e;
      }
    };
  }

  try {
    // 尽可能多地覆盖（window 实例 & 原型）
    var orig = window.postMessage;
    if (orig && typeof orig === 'function') {
      var patched = wrap(orig);
      try { window.postMessage = patched; } catch(_){}
      try { if (window.Window && window.Window.prototype && window.Window.prototype.postMessage) {
        window.Window.prototype.postMessage = patched;
      } } catch(_){}
      console.log('[guard] postMessage patched on kcs2 top');
    }
  } catch(e) { console.warn('[guard] postMessage patch failed', e); }
})();
//# sourceURL=hm-inject://patch-postMessage.js
`;