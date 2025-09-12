export const iframeFitSnippet = `
window.__safeInject('iframeFit', function () {
  var W = 1200, H = 720;
  var STYLE_ALIGN_ID = 'kc-align';
  var STYLE_FIT_ID   = 'kc-fit';
  var policy = 'auto';
  var TOP_GAP = 16;

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

  // only reserve iframe
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

  function computeScale(vw, vh) {
    if (policy === 'height') return vh / H; // 横屏：按高铺满
    if (policy === 'width')  return vw / W; // 竖屏：按宽铺满
    return (vw >= vh) ? (vh / H) : (vw / W);
  }

  // 横屏：水平居中顶对齐；竖屏：顶对齐。并补偿内页下移 TOP_GAP
  function computeOffsets(vw, vh, scale) {
    var cw = W * scale;
    var x = 0, y = -TOP_GAP;               // 关键：整体上抬 16px（transform 在 scale 之后应用）
    if (policy === 'height' || (policy === 'auto' && vw >= vh)) {
      x = Math.max(0, (vw - cw) / 2);
    } else {
      x = 0;
    }
    return { x: x, y: y };
  }

  function snap(v){ var d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }

  function writeFitCSS(vw, vh, scale, off) {
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
    var ifr = findGameIframe(); if (!ifr) return false;
    updateRootSizePx();                          // ← JS 设根尺寸（修复 htmlH/bodyH < innerH）
    var vw = window.innerWidth, vh = window.innerHeight;
    var sc = computeScale(vw, vh);
    var off = computeOffsets(vw, vh, sc);
    writeFitCSS(vw, vh, sc, off);
    applyInline(ifr, sc, off);

    // help reflow
    try { ifr.style.width = (W + 1) + 'px'; void ifr.offsetWidth; ifr.style.width = W + 'px'; } catch (e) {}
    setTimeout(updateRootSizePx, 0);            // 再同步根尺寸（某些机型旋转后需要两次）
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

  // for ArkTS
  window.kcFitReflow = function(){ mountOrReflow(); };
  window.kcFitSetPolicy = function(p){ if (p==='height'||p==='width'||p==='auto'){ policy=p; mountOrReflow(); } };
  window.kcSetTopGap = function(px){ TOP_GAP = (+px|0); mountOrReflow(); };
});
//# sourceURL=hm-inject://iframeFit.js
`;