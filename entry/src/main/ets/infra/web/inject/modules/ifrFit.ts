export const iframeFitSnippet = `
window.__safeInject('iframeFit', function () {
  var W = 1200, H = 720;
  var STYLE_ALIGN_ID = 'kc-align';
  var STYLE_FIT_ID   = 'kc-fit';
  var HOST_ID        = 'kc-host';
  var policy = 'auto';
  var lastPolicy = 'auto';
  var TOP_GAP = 0;
  var LOCK = false;
  var CACHE = null;
  var __KC_DEBUG__ = false;

  var TARGET_WRAP  = null;
  var TARGET_SCALE = null;
  var TARGET_MODE  = 'ifr';// 'ifr' | 'div'

  function dbg(){ if (!__KC_DEBUG__) return;
    var ts=(performance.now()/1000).toFixed(3);
    try{ console.log('[kc]['+ts+']', ...arguments); }catch(_){}
  }

  function ensureStyle(id){
    var el = document.getElementById(id);
    if (!el){ el = document.createElement('style'); el.id=id; (document.head||document.documentElement).appendChild(el); }
    return el;
  }

  function ensureNoZoomMeta() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement('meta'); m.name = 'viewport'; (document.head || document.documentElement).appendChild(m); }
    m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
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

  function vvWidth(){  return Math.round(window.visualViewport ? window.visualViewport.width  : window.innerWidth); }
  function vvHeight(){ return Math.round(window.visualViewport ? window.visualViewport.height : window.innerHeight); }
  function updateRootSizePx(){
    var w = vvWidth(), h = vvHeight();
    var de = document.documentElement, bd = document.body || document.documentElement;
    ['width','min-width','max-width'].forEach(function(p){ try{ de.style.setProperty(p, w+'px', 'important'); bd.style.setProperty(p, w+'px', 'important'); }catch(_){} });
    ['height','min-height','max-height'].forEach(function(p){ try{ de.style.setProperty(p, h+'px', 'important'); bd.style.setProperty(p, h+'px', 'important'); }catch(_){} });
    try { de.style.setProperty('overflow','hidden','important'); bd.style.setProperty('overflow','hidden','important'); } catch(_){}
  }
  function logicalSize(){
    var vw = vvWidth(), vh = vvHeight();
    var lw = Math.max(vw, vh), lh = Math.min(vw, vh);
    return { vw: vw, vh: vh, lw: lw, lh: lh };
  }

  // —— 目标检索 —— //
  function findGameHost(){
    var f = document.querySelector('#game_frame');
    if (f) return { el: f, mode: 'ifr' };

    var list = document.querySelectorAll('iframe');
    for (var i = 0; i < list.length; i++) {
      var n = list[i], src = '';
      try { src = n.getAttribute('src') || n.src || ''; } catch(_) {}
      if (/kcs|osapi\\.dmm\\.com|854854/.test(src) || /kcs/.test((n.id || ''))) {
        return { el: n, mode: 'ifr' };
      }
    }

    var cands = ['#htmlWrap', '#flashWrap', '#main-application', '#game', '#wrapper', '#app'];
    for (var j = 0; j < cands.length; j++) {
      var e = document.querySelector(cands[j]);
      if (e) return { el: e, mode: 'div' };
    }
    var cv = document.querySelector('canvas');
    if (cv) {
      var p = (cv.parentNode && cv.parentNode.nodeType === 1) ? cv.parentNode : cv;
      return { el: p, mode: 'div' };
    }
    return null;
  }

  // —— 生成包裹/确定缩放目标 —— //
  function ensureTargets(hostEl, mode){
    if (!hostEl) return null;
    var wrap, scaleEl;

    if (mode === 'ifr') {
      wrap = hostEl;        // iframe 自身
      scaleEl = hostEl;     // 对 iframe 直接 transform
    } else {
      wrap = document.getElementById(HOST_ID);
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = HOST_ID;
        wrap.setAttribute('data-kc-host','1');
        wrap.style.position = 'absolute';
        wrap.style.left = '0';
        wrap.style.top  = '0';
        wrap.style.border = '0';
        wrap.style.background = '#000';
        wrap.style.overflow = 'visible';
        var parent = (hostEl.parentNode && hostEl.parentNode.nodeType === 1) ? hostEl.parentNode : (document.body || document.documentElement);
        try { parent.insertBefore(wrap, hostEl); } catch(_){ return null; }
        try { wrap.appendChild(hostEl); } catch(_){}
      }
      scaleEl = hostEl;
    }

    try { scaleEl.setAttribute('data-kc-scale','1'); } catch(_){}
    return { wrap: wrap, scale: scaleEl, mode: mode };
  }

  // —— 隔离路径 —— //
  function isolatePath(node){
    var cur = node;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var p = cur.parentElement; if (!p) break;
      var kids = p.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids.item(i);
        if (k !== cur) try { k.style.setProperty('display','none','important'); } catch(_){}
      }
      try {
        p.style.setProperty('margin','0','important');
        p.style.setProperty('padding','0','important');
        p.style.setProperty('border','0','important');
      } catch(_){}
      cur = p;
    }
  }

  // —— 基础样式：固定 1200×720，缩放打在 data-kc-scale —— //
  function applyAlignCSS(){
    var s = ensureStyle(STYLE_ALIGN_ID);
    s.textContent =
      'html{overflow:hidden!important;background:#000!important;height:100vh!important;width:100vw!important}' +
      'body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;height:100vh!important;width:100vw!important}' +
      '::-webkit-scrollbar{width:0!important;height:0!important}' +
      '#game_frame{position:absolute!important;top:0!important;left:0!important;width:'+W+'px!important;height:'+H+'px!important;border:0!important;background:#000!important;display:block!important;backface-visibility:hidden!important;z-index:9999!important}' +
      '[data-kc-scale="1"]{position:absolute!important;top:0!important;left:0!important;width:'+W+'px!important;height:'+H+'px!important;border:0!important;background:#000!important;display:block!important;backface-visibility:hidden!important}' +
      '#'+HOST_ID+'{position:absolute!important;top:0!important;left:0!important;border:0!important;background:#000!important;display:block!important;backface-visibility:hidden!important;overflow:visible!important;z-index:9999!important}';
  }

  // —— 缩放与偏移 —— //
  function computeScale(effW, effH, realVW, realVH) {
    var s;
    if (policy === 'height') {
      s = effH / H;                     // 先按高铺
      if (W * s > realVW) s = realVW / W; // 再卡宽上限（关键）
      return s;
    }
    if (policy === 'width') {
      s = effW / W;                     // 先按宽铺
      if (H * s > realVH) s = realVH / H; // 再卡高上限
      return s;
    }
    return Math.min(realVW / W, realVH / H);
  }
  function computeOffsets(){ return { x: 0, y: -TOP_GAP }; } // 永远贴左
  function snap(v){ var d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }

  function writeFitCSS(scale, off){
    var s = ensureStyle(STYLE_FIT_ID);
    var ox = snap(off.x), oy = snap(off.y);
    s.textContent = '[data-kc-scale="1"]{transform-origin:0 0!important;transform:translate3d('+ox+'px,'+oy+'px,0) scale('+scale+') !important;will-change:transform!important}';
  }
  function applyInline(elScale, scale, off){
    if (!elScale || !elScale.style) return;
    var ox = snap(off.x), oy = snap(off.y);
    elScale.style.position = 'absolute';
    elScale.style.top = '0px';
    elScale.style.left = '0px';
    elScale.style.width = W + 'px';
    elScale.style.height = H + 'px';
    elScale.style.border = '0';
    elScale.style.background = '#000';
    elScale.style.transformOrigin = '0 0';
    elScale.style.transform = 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(' + scale + ')';
  }

  // —— 统一的 reflow（只用 TARGET_*） —— //
  function mountOrReflow() {
    // 目标丢失时尝试重建
    if (!TARGET_SCALE || !TARGET_SCALE.isConnected) {
      dbg('REFLOW missing target → remount');
      TARGET_WRAP = TARGET_SCALE = null;
      return mountOnce();
    }

    updateRootSizePx();
    var s  = logicalSize();
    var vw = s.vw, vh = s.vh;
    var effW = LOCK ? s.lw : vw;
    var effH = LOCK ? s.lh : vh;

    var sc, off;
    var hit = !!(LOCK && CACHE &&
                 CACHE.lock   === LOCK &&
                 CACHE.policy === policy &&
                 CACHE.lw     === effW &&
                 CACHE.lh     === effH);

    if (hit) {
      sc  = CACHE.scale;
      off = { x: CACHE.x, y: CACHE.y };
      dbg('REFLOW cache-hit', 'scale=', sc.toFixed(4));
    } else {
      sc  = computeScale(effW, effH, vw, vh);
      off = computeOffsets();
      dbg('REFLOW recompute', 'policy=', policy, 'scale=', sc.toFixed(4), 'vw/vh=', vw, vh);
      if (LOCK) CACHE = { scale: sc, x: off.x, y: off.y, lw: effW, lh: effH, policy: policy, lock: LOCK };
      else CACHE = null;
    }

    writeFitCSS(sc, off);
    applyInline(TARGET_SCALE, sc, off);
    try { TARGET_SCALE.style.width = (W + 1) + 'px'; void TARGET_SCALE.offsetWidth; TARGET_SCALE.style.width = W + 'px'; } catch (_){}
    setTimeout(updateRootSizePx, 0);
    return true;
  }

  // —— 环境判定（只在顶层 kcs2 生效，避免误注） —— //
  function inKcs2Top(){
    try { return /\\/kcs2\\//i.test(String(location.href||'')) && (window===window.top); }
    catch(e){ return false; }
  }

  // —— 首次挂载 —— //
  function mountOnce(){
    if (TARGET_SCALE && TARGET_SCALE.isConnected) return mountOrReflow();

    var host = findGameHost();
    if (!host) { dbg('MOUNT no host'); return false; }

    var t = ensureTargets(host.el, host.mode);
    if (!t) { dbg('MOUNT ensureTargets failed'); return false; }

    TARGET_WRAP  = t.wrap;
    TARGET_SCALE = t.scale;
    TARGET_MODE  = t.mode;

    dbg('MOUNT target=', TARGET_SCALE && TARGET_SCALE.tagName, 'mode=', TARGET_MODE, 'id=', TARGET_SCALE && TARGET_SCALE.id);

    applyAlignCSS();
    updateRootSizePx();
    isolatePath(TARGET_WRAP);
    return mountOrReflow();
  }

  // —— ArkTS Bridge —— //
  window.kcFitReset = function(){ CACHE = null; dbg('RESET cache'); };
  window.kcFitLock  = function(b){
    var on = !!b;
    if (on !== LOCK) { LOCK = on; CACHE = null; dbg('LOCK ->', LOCK); mountOrReflow(); }
    else { dbg('LOCK unchanged:', LOCK); }
  };
  window.kcFitSetPolicy = function(p){
    if (p==='height'||p==='width'||p==='auto'){
      if (p !== lastPolicy) { lastPolicy = p; try { window.kcFitReset && window.kcFitReset(); } catch(_){ } }
      policy = p; dbg('POLICY ->', policy); mountOrReflow();
    }
  };
  window.kcFitReflow = function(){ mountOrReflow(); };
  window.kcSetTopGap = function(px){ TOP_GAP = (+px|0); mountOrReflow(); };

  // —— 启动 —— //
  function run(){
    if (!inKcs2Top()) { console.log('[fit] skip: not in kcs2 top'); return; }
    installNoZoomGuards();
    if (mountOnce()) {
      var rf = function(){ mountOrReflow(); };
      window.addEventListener('resize', rf);
      window.addEventListener('orientationchange', rf);
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) rf(); });
      // 目标被重建（src/class/style 变化）自动重挂
      var mo = new MutationObserver(function(){
        if (!TARGET_SCALE || !TARGET_SCALE.isConnected) mountOnce();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','style','class'] });
      return;
    }
    var end = Date.now() + 10000, t = setInterval(function(){
      if (mountOnce() || Date.now() > end) clearInterval(t);
    }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
});
//# sourceURL=hm-inject://iframeFit.js
`;