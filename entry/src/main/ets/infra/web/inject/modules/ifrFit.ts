export const iframeFitSnippet = `
window.__safeInject('iframeFit', function () {
  var W = 1200, H = 720;
  var STYLE_ALIGN_ID = 'kc-align';
  var STYLE_FIT_ID   = 'kc-fit';
  var HOST_ID        = 'kc-host';   // 无 iframe 时包一层进行缩放
  var policy = 'auto';
  var lastPolicy = 'auto';
  var TOP_GAP = 16;
  var LOCK = false;     // small screen LOCK
  var CACHE = null;     // { scale, x, y, lw, lh, policy, lock }
  var __KC_DEBUG__ = false;

  var TARGET_EL = null;   // HTMLElement
  var TARGET_MODE = 'ifr';// 'ifr' | 'div'

  function dbg() {
    if (!__KC_DEBUG__) return;
    var ts = (performance.now() / 1000).toFixed(3);
    try { console.log('[kc][' + ts + ']', Array.prototype.slice.call(arguments)); } catch (e) {}
  }

  function ensureStyle(id) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; (document.head || document.documentElement).appendChild(el); }
    return el;
  }

  function ensureNoZoomMeta() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement('meta'); m.name = 'viewport'; (document.head || document.documentElement).appendChild(m); }
    m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  }

  function installNoZoomGuards() {
    ensureNoZoomMeta();
    var s = ensureStyle('kc-nozoom');
    s.textContent =
      'html,body{touch-action:none;-ms-touch-action:none;overscroll-behavior:none}' +
      '#game_frame{touch-action:none}';
    var prevent = function(e){ try{ e.preventDefault(); }catch(_){} };
    ['dblclick','gesturestart','gesturechange','gestureend'].forEach(function(t){
      document.addEventListener(t, prevent, { passive: false, capture: true });
    });
    document.addEventListener('wheel', function(e){ if (e.ctrlKey) prevent(e); }, { passive: false, capture: true });
    document.addEventListener('touchmove', function(e){ if (e.touches && e.touches.length > 1) prevent(e); }, { passive: false, capture: true });
  }

  function vvWidth()  { return Math.round(window.visualViewport ? window.visualViewport.width  : window.innerWidth); }
  function vvHeight() { return Math.round(window.visualViewport ? window.visualViewport.height : window.innerHeight); }

  function updateRootSizePx() {
    var w = vvWidth(), h = vvHeight();
    var de = document.documentElement, bd = document.body || document.documentElement;
    ['width','min-width','max-width'].forEach(function(p){
      try { de.style.setProperty(p, w + 'px', 'important'); } catch(_){}
      try { bd.style.setProperty(p, w + 'px', 'important'); } catch(_){}
    });
    ['height','min-height','max-height'].forEach(function(p){
      try { de.style.setProperty(p, h + 'px', 'important'); } catch(_){}
      try { bd.style.setProperty(p, h + 'px', 'important'); } catch(_){}
    });
    try { de.style.setProperty('overflow','hidden','important'); } catch(_){}
    try { bd.style.setProperty('overflow','hidden','important'); } catch(_){}
  }

  function logicalSize() {
    var vw = vvWidth(), vh = vvHeight();
    var lw = Math.max(vw, vh);
    var lh = Math.min(vw, vh);
    return { vw: vw, vh: vh, lw: lw, lh: lh };
  }

  function findGameHost() {
    var f = document.querySelector('#game_frame');
    if (f) return { el: f, mode: 'ifr' };

    var list = document.querySelectorAll('iframe');
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      var src = '';
      try { src = n.getAttribute('src') || ''; } catch(_) {}
      if (!src) { try { src = n.src || ''; } catch(_) {}
      }
      if (/kcs|osapi\\.dmm\\.com|854854/.test(src) || /kcs/.test(n.id || '')) return { el: n, mode: 'ifr' };
    }

    // kcs2 顶层页：常见容器选择
    var cands = ['#htmlWrap', '#flashWrap', '#main-application', '#game', '#wrapper', '#app'];
    for (var j = 0; j < cands.length; j++) {
      var e = document.querySelector(cands[j]);
      if (e) return { el: e, mode: 'div' };
    }
    var cv = document.querySelector('canvas');
    if (cv) {
      var p = cv.parentNode && cv.parentNode.nodeType === 1 ? cv.parentNode : cv;
      return { el: p, mode: 'div' };
    }
    return null;
  }

  // 当 mode=div 时，确保外面有一个可控的包裹层（kc-host），对这个层做 transform
  function ensureHostWrapper(el, mode) {
    if (!el) return null;
    if (mode === 'ifr') return el;
    if (el.id === HOST_ID || (el.getAttribute && el.getAttribute('data-kc-host') === '1')) return el;

    var wrap = document.createElement('div');
    wrap.id = HOST_ID;
    wrap.setAttribute('data-kc-host', '1');
    wrap.style.position = 'absolute';
    wrap.style.left = '0';
    wrap.style.top = '0';
    wrap.style.border = '0';
    wrap.style.background = '#000';

    var parent = el.parentNode && el.parentNode.nodeType === 1 ? el.parentNode : (document.body || document.documentElement);
    try { parent.insertBefore(wrap, el); } catch(_){ return null; }
    try { wrap.appendChild(el); } catch(_){}
    return wrap;
  }

  function isolatePath(node) {
    var cur = node;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var p = cur.parentElement; if (!p) break;
      var kids = p.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids.item(i);
        if (k !== cur) { try { k.style.setProperty('display', 'none', 'important'); } catch(_){} }
      }
      try {
        p.style.setProperty('margin', '0', 'important');
        p.style.setProperty('padding', '0', 'important');
        p.style.setProperty('border', '0', 'important');
      } catch(_){}
      cur = p;
    }
  }

  function applyAlignCSS() {
    var s = ensureStyle(STYLE_ALIGN_ID);
    s.textContent =
      'html{overflow:hidden!important;background:#000!important;height:100vh!important;width:100vw!important}' +
      'body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;height:100vh!important;width:100vw!important}' +
      '::-webkit-scrollbar{width:0!important;height:0!important}' +
      '#game_frame,#'+HOST_ID+'{position:absolute!important;top:0!important;left:0!important;width:'+W+'px!important;height:'+H+'px!important;border:0!important;background:#000!important;display:block!important;backface-visibility:hidden!important;z-index:9999!important}';
  }

  function computeScale(lw, lh) {
    if (policy === 'height') { var s1 = lh / H; if (W * s1 > lw) s1 = lw / W; return s1; }
    if (policy === 'width')  { var s2 = lw / W; if (H * s2 > lh) s2 = lh / H; return s2; }
    return Math.min(lw / W, lh / H);
  }

  function computeOffsets() { return { x: 0, y: -TOP_GAP }; }

  function snap(v){ var d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }

  function writeFitCSS(scale, off) {
    var s = ensureStyle(STYLE_FIT_ID);
    var ox = snap(off.x), oy = snap(off.y);
    s.textContent =
      '#game_frame,#'+HOST_ID+'{transform-origin:0 0!important;transform:translate3d('+ox+'px,'+oy+'px,0) scale('+scale+') !important;will-change:transform!important}';
  }

  function applyInline(el, scale, off) {
    if (!el || !el.style) return; // FIX: 空值保护
    var ox = snap(off.x), oy = snap(off.y);
    try {
      el.style.position = 'absolute';
      el.style.top = '0px';
      el.style.left = '0px';
      el.style.width = W + 'px';
      el.style.height = H + 'px';
      el.style.border = '0';
      el.style.background = '#000';
      el.style.transformOrigin = '0 0';
      el.style.transform = 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(' + scale + ')';
    } catch(_){}
  }

  function mountOrReflow() {
    var el = TARGET_EL;
    if (!el) { dbg('REFLOW no TARGET'); return false; }

    updateRootSizePx();
    var s  = logicalSize();
    var lw = LOCK ? s.lw : s.vw;
    var lh = LOCK ? s.lh : s.vh;

    var sc, off;
    var hit = !!(LOCK && CACHE &&
                 CACHE.lock   === LOCK &&
                 CACHE.policy === policy &&
                 CACHE.lw     === lw &&
                 CACHE.lh     === lh);

    if (hit) {
      sc  = CACHE.scale;
      off = { x: CACHE.x, y: CACHE.y };
      dbg('REFLOW cache-hit', 'lock=', LOCK, 'policy=', policy, 'scale=', sc.toFixed(4), 'lw/lh=', lw, lh);
    } else {
      sc  = computeScale(lw, lh);
      off = computeOffsets();
      dbg('REFLOW recompute', 'lock=', LOCK, 'policy=', policy, 'scale=', sc.toFixed(4), 'lw/lh=', lw, lh);
      if (LOCK) { CACHE = { scale: sc, x: off.x, y: off.y, lw: lw, lh: lh, policy: policy, lock: LOCK }; }
      else { CACHE = null; }
    }

    writeFitCSS(sc, off);
    applyInline(el, sc, off);

    try { el.style.width = (W + 1) + 'px'; void el.offsetWidth; el.style.width = W + 'px'; } catch (e) {}
    setTimeout(updateRootSizePx, 0);
    return true;
  }

  function mountOnce() {
    // 若已锁定，直接 reflow
    if (TARGET_EL) return mountOrReflow();

    var host = findGameHost(); if (!host) { dbg('MOUNT no host yet'); return false; }
    var el = ensureHostWrapper(host.el, host.mode); if (!el) { dbg('MOUNT wrap failed'); return false; }

    TARGET_EL = el;            // FIX: 锁定宿主
    TARGET_MODE = host.mode;

    applyAlignCSS();
    updateRootSizePx();
    isolatePath(el);
    return mountOrReflow();
  }

  // —— ArkTS Bridge —— //
  window.kcFitReset = function () { CACHE = null; dbg('RESET cache'); };
  window.kcFitLock = function (b) {
    var on = !!b;
    if (on !== LOCK) {
      LOCK = on; CACHE = null; dbg('LOCK ->', LOCK, '(CACHE cleared)');
      mountOrReflow();
    } else { dbg('LOCK unchanged:', LOCK); }
  };
  window.kcFitSetPolicy = function(p){
    if (p==='height'||p==='width'||p==='auto'){
      if (p !== lastPolicy) { lastPolicy = p; try { window.kcFitReset && window.kcFitReset(); } catch(e){} }
      policy = p; dbg('POLICY ->', policy);
      mountOrReflow();
    }
  };
  window.kcFitReflow = function(){ mountOrReflow(); };
  window.kcSetTopGap = function(px){ TOP_GAP = (+px|0); mountOrReflow(); };

  // —— 挂载流程：立即尝试 + 监听 DOM 变化 + 安全轮询 —— //
  function run() {
    installNoZoomGuards();
    if (mountOnce()) {
      var rf = function(){ mountOrReflow(); };
      window.addEventListener('resize', rf);
      window.addEventListener('orientationchange', rf);
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) rf(); });
      return;
    }
    var mo = new MutationObserver(function(){ if (mountOnce()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','style','class'] });
    var end = Date.now() + 10000, t = setInterval(function(){
      if (mountOnce() || Date.now() > end) clearInterval(t);
    }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
});
//# sourceURL=hm-inject://iframeFit.js
`;
