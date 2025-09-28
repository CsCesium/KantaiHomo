//entry/src/main/ets/infra/web/inject/modules/promoteGameFrame
export const promoteGameFrameSnippet: string = `
(function(){
  // 兼容无 __safeInject 的环境
  var __safe = (typeof window.__safeInject === 'function')
    ? window.__safeInject
    : function(_tag, fn){ try{ fn(); }catch(e){} };

  __safe('promoteGameFrame', function(){
    try {
      if (/\\/kcs2\\//i.test(location.href)) {
        console.log('[promote] already on kcs2:', location.href);
        return;
      }

      var KEY = '__hm_promote_last';
      var last = '';
      try { last = sessionStorage.getItem(KEY) || ''; } catch(e){}

      var decided = false;

      function pickTarget(){
        // 扫描全站 iframe；优先 kcs2，其次 gadgets 容器
        var frames = document.getElementsByTagName('iframe');
        var gadget = '';
        for (var i = 0; i < frames.length; i++) {
          var f = frames[i];
          var src = '';
          try { src = f.src || ''; } catch(e){}
          if (!src) { try { src = (f.getAttribute && f.getAttribute('src')) || ''; } catch(e){} }
          if (!src) continue;

          if (/\\/kcs2\\//i.test(src)) return { target: src, reason: 'kcs2' };
          if (!gadget && /osapi\\.dmm\\.com\\/gadgets\\/ifr/i.test(src)) gadget = src;
        }
        if (gadget) return { target: gadget, reason: 'gadgets' };
        return null;
      }

      function navigate(t){
        if (!t || decided) return;
        if (last === t.target) { console.log('[promote] skip same target:', t.target); return; }
        decided = true;
        try { sessionStorage.setItem(KEY, t.target); } catch(e){}
        console.warn('[promote] navigating to (' + t.reason + '):', t.target);
        location.href = t.target;
      }

      function maybe(){
        if (decided) return;
        var t = pickTarget();
        if (t) navigate(t);
      }

      // 立即 + DOMContentLoaded + load 触发一次
      setTimeout(maybe, 0);
      document.addEventListener('DOMContentLoaded', maybe);
      window.addEventListener('load', maybe);

      // 监听 DOM 变化（iframe 加载 / src 赋值）
      try {
        var obs = new MutationObserver(function(muts){
          if (decided) return;
          for (var i = 0; i < muts.length; i++) {
            var m = muts[i];
            if (m.type === 'childList' || (m.type === 'attributes' && m.attributeName === 'src')) {
              maybe();
              break;
            }
          }
        });
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
      } catch(e){}

      // 安全轮询（最多约 15 秒）
      var tries = 0;
      var timer = setInterval(function(){
        if (decided) { clearInterval(timer); return; }
        tries++;
        if (tries > 30) { clearInterval(timer); console.log('[promote] give up (timeout)'); return; }
        maybe();
      }, 500);

      console.log('[promote] armed (observer+polling), origin=', location.origin);
    } catch(e) {
      console.warn('[promote] failed', e);
    }
  });

  console.log('[promote] boot, origin=', location.origin);
})();
`;