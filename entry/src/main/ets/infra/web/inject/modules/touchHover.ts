export const touchHoverSnippet = `
(function(){
  window.__safeInject('touch-hover', function(){
    var GAME_W = 1200;
    var GAME_H = 720;
    var raf = 0;
    var pending = null;
    var lastCanvas = null;
    var STYLE_ID = 'kca-touch-hover-style';

    function installStyle() {
      if (document.getElementById(STYLE_ID)) return;
      var s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent =
        'canvas{-webkit-tap-highlight-color:rgba(0,0,0,0)!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;touch-action:none!important;-ms-touch-action:none!important;outline:none!important}' +
        '#game_frame,[data-kc-scale="1"]{-webkit-tap-highlight-color:rgba(0,0,0,0)!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}';
      (document.head || document.documentElement).appendChild(s);
    }

    function isUsableCanvas(canvas) {
      if (!canvas || !canvas.getBoundingClientRect) return false;
      var r = canvas.getBoundingClientRect();
      return r.width > 100 && r.height > 100;
    }

    function canvasAt(x, y) {
      var list = document.getElementsByTagName('canvas');
      for (var i = list.length - 1; i >= 0; i--) {
        var c = list[i];
        if (!isUsableCanvas(c)) continue;
        var r = c.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c;
      }
      return null;
    }

    function hasUsableCanvas() {
      var list = document.getElementsByTagName('canvas');
      for (var i = 0; i < list.length; i++) {
        if (isUsableCanvas(list[i])) return true;
      }
      return false;
    }

    function isEditableTarget(target) {
      var n = target;
      while (n && n.nodeType === 1) {
        var tag = String(n.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || n.isContentEditable) return true;
        n = n.parentElement;
      }
      return false;
    }

    function preventSelection(e) {
      if (!hasUsableCanvas() || isEditableTarget(e && e.target)) return;
      try { e.preventDefault(); } catch (_) {}
    }

    function mouseOpts(x, y) {
      return {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        button: 0,
        buttons: 0
      };
    }

    function pointerOpts(x, y) {
      var o = mouseOpts(x, y);
      o.pointerId = 1;
      o.pointerType = 'mouse';
      o.isPrimary = true;
      return o;
    }

    function dispatchHover(canvas, x, y) {
      if (!canvas) return false;
      var mo = mouseOpts(x, y);

      if (lastCanvas !== canvas) {
        if (lastCanvas && lastCanvas.isConnected) {
          try { lastCanvas.dispatchEvent(new MouseEvent('mouseout', mo)); } catch (_) {}
          if (window.PointerEvent) {
            try { lastCanvas.dispatchEvent(new PointerEvent('pointerout', pointerOpts(x, y))); } catch (_) {}
          }
        }
        lastCanvas = canvas;
        try { canvas.dispatchEvent(new MouseEvent('mouseover', mo)); } catch (_) {}
        if (window.PointerEvent) {
          try { canvas.dispatchEvent(new PointerEvent('pointerover', pointerOpts(x, y))); } catch (_) {}
        }
      }

      try { canvas.dispatchEvent(new MouseEvent('mousemove', mo)); } catch (_) {}
      if (window.PointerEvent) {
        try { canvas.dispatchEvent(new PointerEvent('pointermove', pointerOpts(x, y))); } catch (_) {}
      }
      return true;
    }

    function queueHover(x, y) {
      var canvas = canvasAt(x, y);
      if (!canvas) return false;
      pending = { canvas: canvas, x: x, y: y };
      if (raf) return true;
      raf = requestAnimationFrame(function(){
        raf = 0;
        var p = pending;
        pending = null;
        if (p) dispatchHover(p.canvas, p.x, p.y);
      });
      return true;
    }

    function firstTouch(e) {
      if (!e || !e.touches || e.touches.length !== 1) return null;
      return e.touches[0];
    }

    function onTouch(e) {
      var t = firstTouch(e);
      if (!t) return;
      if (!queueHover(t.clientX, t.clientY)) return;
      try { e.preventDefault(); } catch (_) {}
    }

    function onPointer(e) {
      if (window.__kcaTouchWheelActive) return;
      if (!e || e.pointerType === 'mouse') return;
      if (!queueHover(e.clientX, e.clientY)) return;
      try { e.preventDefault(); } catch (_) {}
    }

    window.__kcaHoverAtClientPoint = function(x, y) {
      x = Number(x);
      y = Number(y);
      if (!isFinite(x) || !isFinite(y)) return false;
      var canvas = canvasAt(x, y);
      return dispatchHover(canvas, x, y);
    };

    window.__kcaHoverAtGamePoint = function(x, y) {
      x = Number(x);
      y = Number(y);
      if (!isFinite(x) || !isFinite(y)) return false;
      var list = document.getElementsByTagName('canvas');
      var canvas = null;
      for (var i = list.length - 1; i >= 0; i--) {
        if (isUsableCanvas(list[i])) {
          canvas = list[i];
          break;
        }
      }
      if (!canvas) return false;
      var r = canvas.getBoundingClientRect();
      return dispatchHover(canvas, r.left + x / GAME_W * r.width, r.top + y / GAME_H * r.height);
    };

    installStyle();
    document.addEventListener('touchstart', onTouch, { capture: true, passive: false });
    document.addEventListener('touchmove', onTouch, { capture: true, passive: false });
    document.addEventListener('pointerdown', onPointer, { capture: true, passive: false });
    document.addEventListener('pointermove', onPointer, { capture: true, passive: false });
    document.addEventListener('selectstart', preventSelection, { capture: true, passive: false });
    document.addEventListener('dragstart', preventSelection, { capture: true, passive: false });
    console.log('[touch-hover] installed');
  });
})();
`;
