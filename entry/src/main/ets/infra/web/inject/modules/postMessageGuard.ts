export const postMessageGuardSnippet: string = `
(function(){
  var __safe = (typeof window.__safeInject === 'function')
    ? window.__safeInject
    : function(_tag, fn){ try { fn(); } catch (e) {} };

  function inKcs2Top(){
    try { return /\\/kcs2\\//i.test(String(location.href||'')) && (window===window.top); }
    catch(e){ return false; }
  }

  __safe('postMessageGuard', function(){
    try {
      if (!inKcs2Top()) return;
      if (typeof window.postMessage !== 'function') return;

      var orig = window.postMessage;
      if (orig && orig.__hm_patched) return;

      function guarded(message, targetOrigin, transfer){
        try {
          if (typeof targetOrigin === 'string' && /osapi\\.dmm\\.com/i.test(targetOrigin)) {
            targetOrigin = '*'; // 或改为 location.origin
          }
          return orig.call(this, message, targetOrigin, transfer);
        } catch (e) {
          try { return orig.call(this, message, '*', transfer); } catch (e2) { return; }
        }
      }
      try { guarded.__hm_patched = true; } catch(_) {}
      try { window.postMessage = guarded; } catch (e) {}

      try { console.log('[postMessageGuard] installed (kcs2 top)'); } catch(_) {}
    } catch (e) {
      try { console.warn('[postMessageGuard] failed', e); } catch(_) {}
    }
  });
})();
`;
