export const promoteGameFrameSnippet: string = `
(function(){
  var __safe = (typeof window.__safeInject === 'function')
    ? window.__safeInject
    : function(_tag, fn){ try { fn(); } catch (e) {} };

  function absUrl(u){
    if (!u) return '';
    try {
      if (/^https?:\\/\\//i.test(u)) return u;
      if (/^\\/\\//.test(u)) return (location.protocol || 'https:') + u;
      return u;
    } catch (e) { return u; }
  }
  function inShell(){ try { return /^https?:\\/\\/play\\.games\\.dmm\\.com\\/game\\/kancolle/i.test(String(location.href||'')); } catch(e){ return false; } }
  function inGadget(){ try { return /^https?:\\/\\/osapi\\.dmm\\.com\\/gadgets\\/ifr/i.test(String(location.href||'')); } catch(e){ return false; } }
  function inKcs2Top(){ try { return /\\/kcs2\\//i.test(String(location.href||'')) && (window===window.top); } catch(e){ return false; } }

  __safe('promoteGameFrame', function(){
    try {
      if (inKcs2Top()) {
        try { console.log('[promote] already on kcs2:', location.href); } catch(_) {}
        return;
      }

      var KEY='__hm_promote_last_v2';
      var last=''; try { last = sessionStorage.getItem(KEY)||''; } catch(e){}

      function pickTarget(){
        // S1: play.games.dmm.com -> gadgets
        if (inShell()) {
          var f = document.querySelector('iframe#game_frame, iframe[src*="osapi.dmm.com/gadgets/ifr"]');
          if (f) {
            var s = f.getAttribute('src') || '';
            if (!s) { try { s = f.src || ''; } catch(e){} }
            if (s) return { target: absUrl(s), reason: 'gadgets@play' };
          }
        }
        // S2: osapi.dmm.com/gadgets/ifr -> kcs2
        if (inGadget()) {
          var list = document.getElementsByTagName('iframe');
          for (var i=0;i<list.length;i++){
            var t=''; try { t = list[i].getAttribute('src') || list[i].src || ''; } catch(e){}
            if (t && /\\/kcs2\\//i.test(t)) return { target: absUrl(t), reason: 'kcs2@gadgets' };
          }
        }
        // Fallback：任意页优先找 gadgets
        var frames = document.getElementsByTagName('iframe');
        for (var j=0;j<frames.length;j++){
          var u=''; try { u = frames[j].getAttribute('src') || frames[j].src || ''; } catch(e){}
          if (u && /osapi\\.dmm\\.com\\/gadgets\\/ifr/i.test(u)) return { target: absUrl(u), reason: 'gadgets@fallback' };
        }
        return null;
      }

      var decided=false;
      function navigate(t){
        if (!t || decided) return;
        if (last === t.target) { try { console.log('[promote] skip same target:', t.target); } catch(_) {} return; }
        decided=true;
        try { sessionStorage.setItem(KEY, t.target); } catch(e){}
        try { console.warn('[promote] navigating to ('+t.reason+'):', t.target); } catch(_) {}
        location.href = t.target;
      }
      function maybe(){ if (!decided){ var t = pickTarget(); if (t) navigate(t); } }

      setTimeout(maybe, 0);
      try { document.addEventListener('DOMContentLoaded', maybe, { once: true }); } catch(_) {}
      try { window.addEventListener('load', maybe, { once: true }); } catch(_) {}

      try {
        var obs = new MutationObserver(function(muts){
          if (decided) return;
          for (var i=0;i<muts.length;i++){
            var m = muts[i];
            if (m.type==='childList' || (m.type==='attributes' && m.attributeName==='src')) { maybe(); break; }
          }
        });
        obs.observe(document.documentElement || document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['src'] });
      } catch (e) {}

      var tries=0;
      var tm = setInterval(function(){
        if (decided) { clearInterval(tm); return; }
        tries++; if (tries>40) { clearInterval(tm); try { console.log('[promote] give up (timeout)'); } catch(_) {} return; }
        maybe();
      }, 500);

      try { console.log('[promote] armed'); } catch(e){}
    } catch (e) {
      try { console.warn('[promote] failed', e); } catch(_) {}
    }
  });

  try { console.log('[promote] boot'); } catch(e){}
})();
`;
