export const touchHoverSnippet = `
(function(){
  window.__safeInject('touch-hover', function(){
    var GAME_W = 1200;
    var GAME_H = 720;
    var raf = 0;
    var pending = null;
    var lastCanvas = null;

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
      if (!canvas) return;
      pending = { canvas: canvas, x: x, y: y };
      if (raf) return;
      raf = requestAnimationFrame(function(){
        raf = 0;
        var p = pending;
        pending = null;
        if (p) dispatchHover(p.canvas, p.x, p.y);
      });
    }

    function firstTouch(e) {
      if (!e || !e.touches || e.touches.length < 1) return null;
      return e.touches[0];
    }

    function onTouch(e) {
      var t = firstTouch(e);
      if (!t) return;
      queueHover(t.clientX, t.clientY);
    }

    function onPointer(e) {
      if (!e || e.pointerType === 'mouse') return;
      queueHover(e.clientX, e.clientY);
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

    document.addEventListener('touchstart', onTouch, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouch, { capture: true, passive: true });
    document.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    console.log('[touch-hover] installed');
  });
})();
`;
