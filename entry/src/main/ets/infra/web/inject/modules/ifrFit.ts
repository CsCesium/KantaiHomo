export const iframeFitSnippet = `
window.__safeInject('iframeFit', function () {
  var W = 1200, H = 720;
  var STYLE_ALIGN_ID = 'kc-align';
  var STYLE_FIT_ID   = 'kc-fit';
  var policy = 'auto';
  var lastPolicy = 'auto';
  var TOP_GAP = 16;
  var LOCK = false;     // small screen LOCK
  var CACHE = null; // { scale, x, y, lw, lh, policy }
  var __KC_DEBUG__ = false;

  function dbg() {
  if (!__KC_DEBUG__) return;
  var ts = (performance.now() / 1000).toFixed(3);
  try { console.log('[kc][' + ts + ']', ...arguments); } catch (e) {}
  try { if (window.hmos && typeof hmos.post === 'function') hmos.post('[kc] ' + [].join.call(arguments, ' ')); } catch(e){}
  }

  function stateSnapshot() {
    var vw = vvWidth(), vh = vvHeight();
    var lw = Math.max(vw, vh), lh = Math.min(vw, vh);
    return {
      policy: policy,
      LOCK: LOCK,
      CACHE: !!CACHE,
      vw: vw, vh: vh, lw: lw, lh: lh,  // 三个坐标维度
      TOP_GAP: TOP_GAP
    };
  }

function ensureNoZoomMeta() {
  var m = document.querySelector('meta[name="viewport"]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
  // 禁止缩放：双击/捏合都无效
  m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

  function installNoZoomGuards() {
    ensureNoZoomMeta();

    // CSS 禁用手势缩放
    var s = ensureStyle('kc-nozoom');
    s.textContent =
      'html,body{touch-action:none;-ms-touch-action:none;overscroll-behavior:none}' +
      '#game_frame{touch-action:none}';


    var prevent = function(e){ try{ e.preventDefault(); }catch(_){} };
    ['dblclick','gesturestart','gesturechange','gestureend'].forEach(function(t){
      document.addEventListener(t, prevent, { passive: false, capture: true });
    });
    document.addEventListener('wheel', function(e){
      if (e.ctrlKey) prevent(e);
    }, { passive: false, capture: true });
    document.addEventListener('touchmove', function(e){
      if (e.touches && e.touches.length > 1) prevent(e);
    }, { passive: false, capture: true });
  }

  window.kcFitDump = function() {
    var o = stateSnapshot();
    dbg('DUMP', JSON.stringify(o));
    return o;
  };

  function ensureStyle(id) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    return el;
  }

  function findGameIframe() {
    var f = document.querySelector('#game_frame');
    if (f) return f;
    var list = document.querySelectorAll('iframe');
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      var src = n.getAttribute('src') || n.getAttribute('data-src') || '';
      if (/kcs|osapi\\.dmm\\.com|854854/.test(src) || /kcs/.test(n.id)) return n;
    }
    return null;
  }

  function isolateIframePath(ifr) {
    var node = ifr;
    while (node && node !== document.body) {
      var p = node.parentElement; if (!p) break;
      var kids = p.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids.item(i);
        if (k !== node) k.style.setProperty('display', 'none', 'important');
      }
      p.style.setProperty('margin', '0', 'important');
      p.style.setProperty('padding', '0', 'important');
      p.style.setProperty('border', '0', 'important');
      node = p;
    }
  }

  // —— CSS + JS  ——
  function applyAlignCSS() {
    var s = ensureStyle(STYLE_ALIGN_ID);
    s.textContent =
      'html{overflow:hidden!important;background:#000!important;height:100vh!important;width:100vw!important}' +
      'body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;height:100vh!important;width:100vw!important}' +
      '::-webkit-scrollbar{width:0!important;height:0!important}' +
      '#game_frame{position:absolute!important;top:0!important;left:0!important;width:'+W+'px!important;height:'+H+'px!important;border:0!important;background:#000!important;display:block!important;backface-visibility:hidden!important;z-index:9999!important}';
  }

  function vvWidth()  { return Math.round(window.visualViewport ? window.visualViewport.width  : window.innerWidth); }
  function vvHeight() { return Math.round(window.visualViewport ? window.visualViewport.height : window.innerHeight); }

  function updateRootSizePx() {
    var w = vvWidth(), h = vvHeight();
    var de = document.documentElement, bd = document.body;

    ['width','min-width','max-width'].forEach(function(p){
      de.style.setProperty(p, w + 'px', 'important');
      bd.style.setProperty(p, w + 'px', 'important');
    });
    ['height','min-height','max-height'].forEach(function(p){
      de.style.setProperty(p, h + 'px', 'important');
      bd.style.setProperty(p, h + 'px', 'important');
    });
    de.style.setProperty('overflow','hidden','important');
    bd.style.setProperty('overflow','hidden','important');
  }


  function logicalSize() {
    var vw = vvWidth(), vh = vvHeight();
    var lw = Math.max(vw, vh); // logical width
    var lh = Math.min(vw, vh); // logical height
    return { vw: vw, vh: vh, lw: lw, lh: lh };
  }

  function computeScale(lw, lh) {
    if (policy === 'height') {
      var s = lh / H;
      if (W * s > lw) s = lw / W;
      return s;
    }
    if (policy === 'width')  {
      var s = lw / W;
      if (H * s > lh) s = lh / H;
      return s;
    }
    // auto：minimize the size
    return Math.min(lw / W, lh / H);
  }

  function computeOffsets(logicalWidth, scale) {
    var cw = W * scale;
    var x = 0;
    // if (LOCK) {
    //   x = (LEFT_GAP / scale);
    // } else {
    //   x = (logicalWidth - cw) / 2;
    // }
    var y = -TOP_GAP; // Fix the CSS error
    return { x: x, y: y };
  }

  function snap(v){ var d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }

  function writeFitCSS(scale, off) {
    var s = ensureStyle(STYLE_FIT_ID);
    var ox = snap(off.x), oy = snap(off.y);
    s.textContent =
      '#game_frame{transform-origin:0 0!important;transform:translate3d('+ox+'px,'+oy+'px,0) scale('+scale+') !important;will-change:transform!important}';
  }

  function applyInline(ifr, scale, off) {
    var ox = snap(off.x), oy = snap(off.y);
    ifr.style.position = 'absolute';
    ifr.style.top = '0px';
    ifr.style.left = '0px';
    ifr.style.width = W + 'px';
    ifr.style.height = H + 'px';
    ifr.style.border = '0';
    ifr.style.background = '#000';
    ifr.style.transformOrigin = '0 0';
    ifr.style.transform = 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(' + scale + ')';
  }

  function mountOrReflow() {
    var ifr = findGameIframe(); if (!ifr) { dbg('NO IFRAME'); return false; }
    updateRootSizePx();

    var s  = logicalSize();
    var lw = LOCK ? s.lw : s.vw;
    var lh = LOCK ? s.lh : s.vh;

    var sc, off;

    var hit = !!(LOCK && CACHE &&
                 CACHE.lock   === LOCK &&
                 CACHE.policy === policy &&
                 CACHE.lw     === lw &&
                 CACHE.lh     === lh /* && CACHE.topGap === TOP_GAP */);

    if (hit) {
      sc  = CACHE.scale;
      off = { x: CACHE.x, y: CACHE.y };
      dbg('REFLOW cache-hit', 'LOCK=', LOCK, 'policy=', policy, 'scale=', sc.toFixed(4), 'off=', off.x.toFixed(1), off.y.toFixed(1), 'lw/lh=', lw, lh);
    } else {
      sc  = computeScale(lw, lh);
      off = computeOffsets(lw, sc);
      dbg('REFLOW recompute', 'LOCK=', LOCK, 'policy=', policy, 'scale=', sc.toFixed(4), 'off=', off.x.toFixed(1), off.y.toFixed(1), 'lw/lh=', lw, lh);

      if (LOCK) {
        CACHE = { scale: sc, x: off.x, y: off.y, lw: lw, lh: lh, policy: policy, lock: LOCK /*, topGap: TOP_GAP*/ };
      } else {
        CACHE = null;
      }
    }

    writeFitCSS(sc, off);
    applyInline(ifr, sc, off);

    try { ifr.style.width = (W + 1) + 'px'; void ifr.offsetWidth; ifr.style.width = W + 'px'; } catch (e) {}
    setTimeout(updateRootSizePx, 0);
    return true;
  }

  function mountOnce() {
    var ifr = findGameIframe(); if (!ifr) return false;
    applyAlignCSS();
    updateRootSizePx();
    isolateIframePath(ifr);
    return mountOrReflow();
  }

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
    mo.observe(document.documentElement, { childList: true, subtree: true });
    var end = Date.now() + 10000, t = setInterval(function(){
      if (mountOnce() || Date.now() > end) clearInterval(t);
    }, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  // —— ArkTS Bridge ——
  window.kcFitReset = function () { CACHE = null; dbg('RESET cache'); };
  window.kcFitLock = function (b) {
    var on = !!b;
    if (on !== LOCK) {
      LOCK = on;
      CACHE = null;
      dbg('LOCK ->', LOCK, '(CACHE cleared)');
      mountOrReflow();
    }else {
    dbg('LOCK unchanged:', LOCK);
    }
  };

  window.kcFitSetPolicy = function(p){
    if (p==='height'||p==='width'||p==='auto'){
      if (p !== lastPolicy) {
        lastPolicy = p;
        try { window.kcFitReset && window.kcFitReset(); } catch(e){}
      }
      policy = p;
      dbg('POLICY ->', policy);
      mountOrReflow();
    }
  };

  window.kcFitReflow = function(){ mountOrReflow(); };
  window.kcSetTopGap = function(px){ TOP_GAP = (+px|0); mountOrReflow(); };
});
//# sourceURL=hm-inject://iframeFit.js
`;