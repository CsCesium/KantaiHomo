export const kcDebugSnippet = `
window.__safeInject('kcDebug', function () {
  var __KC_DEBUG__ = true;
  function ts(){ return (performance.now()/1000).toFixed(3); }
  function log(){ try{ console.log('[kc]['+ts()+']', ...Array.prototype.slice.call(arguments)); }catch(e){} }

  // —— 基本环境 —— //
  try{
    log('ENV ua=', navigator.userAgent);
    log('ENV dpr=', window.devicePixelRatio||1,
        'vv=', (window.visualViewport ? [visualViewport.width|0, visualViewport.height|0] : [innerWidth|0, innerHeight|0]));
    log('ENV lang=', navigator.language, 'plat=', navigator.platform);
    log('ENV location=', String(location.href));
    log('ENV visibility=', document.visibilityState);
  }catch(_){}

  // —— 可见性 & 页面生命周期 —— //
  document.addEventListener('visibilitychange', function(){ log('visibility', document.visibilityState); });
  window.addEventListener('pageshow', e => log('pageshow', e.persisted));
  window.addEventListener('pagehide', e => log('pagehide', e.persisted));

  // —— 首次绘制指标（FP/FCP） —— //
  try{
    if ('PerformanceObserver' in window) {
      var po = new PerformanceObserver(function(list){
        list.getEntries().forEach(function(it){
          if (it.name==='first-paint' || it.name==='first-contentful-paint') {
            log('paint', it.name, it.startTime.toFixed(1));
          }
        });
      });
      po.observe({ type:'paint', buffered:true });
    }
  }catch(_){}

  // —— WebGL 诊断 —— //
  (function(){
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    var ok = !!gl;
    log('webglSupported', ok);
    if (ok) {
      try{
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        var vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   : gl.getParameter(gl.VENDOR);
        var render = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        log('webglInfo', vendor, render);
      }catch(e){}
      document.addEventListener('webglcontextlost',     e => log('webglcontextlost', e.target && e.target.tagName), true);
      document.addEventListener('webglcontextrestored', e => log('webglcontextrestored', e.target && e.target.tagName), true);
    }
  })();

  // —— RAF/FPS 监视 —— //
  (function(){
    var last = performance.now(), frames = 0, running = true;
    function tick(now){
      frames++;
      if (now - last >= 1000) {
        log('fps', frames);
        frames = 0; last = now;
      }
      if (running) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    window.kcDebugRaf = {
      stop(){ running = false; },
      start(){ if(!running){ running = true; last = performance.now(); frames = 0; requestAnimationFrame(tick);} }
    };
  })();

  // —— Canvas 祖先样式体检（易致黑屏的 transform/filter/opacity/overflow） —— //
  (function(){
    function flags(el){
      var cs = getComputedStyle(el);
      return {
        opacity: cs.opacity,
        transform: cs.transform !== 'none',
        filter: cs.filter !== 'none',
        backdropFilter: (cs.backdropFilter && cs.backdropFilter!=='none'),
        overflowHidden: (cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.overflowY==='hidden'),
        mixBlend: (cs.mixBlendMode && cs.mixBlendMode!=='normal')
      };
    }
    function dump(){
      var cvs = Array.prototype.slice.call(document.querySelectorAll('canvas'));
      if (!cvs.length) { log('canvas none'); return; }
      cvs.forEach(function(cv, i){
        var p = cv.parentElement || document.body;
        log('canvas#'+i,
            'size', cv.width+'x'+cv.height,
            'css',  (cv.style.width||'?')+'x'+(cv.style.height||'?'),
            'flags', flags(cv),
            'parentFlags', flags(p));
      });
    }
    window.kcDebugDumpCanvas = dump;
    setTimeout(dump, 1500);
  })();

  // —— AudioContext 状态（常见“需手势”阻塞排查） —— //
  (function(){
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        var ac = new AC();
        log('audioContextState', ac.state);
        ac.onstatechange = function(){ log('audioContextState', ac.state); };
        ac.resume().then(() => log('audioResume ok', ac.state))
                   .catch(err => log('audioResume fail', String(err && err.message || err)));
        window.kcDebugAudio = ac;
      } else {
        log('audioContext', 'unsupported');
      }
    }catch(e){ log('audioContext error', String(e && e.message || e)); }
  })();

  // —— 轻量网络观测（默认关闭；不改包体） —— //
  (function(){
    var enable = false;
    function set(on){ enable = !!on; log('netmon enable=', enable); }
    var _fetch = window.fetch;
    if (_fetch) {
      window.fetch = function(){
        if (enable) try{ log('fetch', arguments[0]); }catch(_){}
        return _fetch.apply(this, arguments);
      };
    }
    var P = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (P && P.open && P.send) {
      var _open = P.open, _send = P.send;
      P.open = function(m,u){ this.__kc_m=m; this.__kc_u=u; return _open.apply(this, arguments); };
      P.send = function(b){ if (enable) try{ log('xhr', this.__kc_m, this.__kc_u); }catch(_){}
                           return _send.apply(this, arguments); };
    }
    window.kcDebugNet = set; // 用法：kcDebugNet(true)
  })();

  // —— 关键元素出现监视 —— //
  (function(){
    function exists(sel){ var el = document.querySelector(sel); log('exists', sel, !!el); return !!el; }
    exists('#game_frame');
    var mo = new MutationObserver(function(muts){
      if (document.querySelector('#game_frame')) { log('game_frame found'); try{ mo.disconnect(); }catch(_){} }
    });
    try{ mo.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['id','class','style','src']}); }catch(_){}
  })();

  // —— 快照 —— //
  window.kcDebugSnapshot = function(){
    var s = {
      url: location.href,
      visible: document.visibilityState,
      dpr: window.devicePixelRatio||1,
      vv: window.visualViewport ? {w:visualViewport.width|0,h:visualViewport.height|0,scale:visualViewport.scale} : {w:innerWidth|0,h:innerHeight|0},
      time: Date.now()
    };
    try{ log('snapshot', s); }catch(_){}
    return s;
  };
});
//# sourceURL=hm-inject://kcDebug.js
`;
