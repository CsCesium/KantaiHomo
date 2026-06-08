import { resolveTouchWheelScale } from '../../input/touchWheelSensitivity';

export function touchWheelSnippet(sensitivityPercent: number): string {
  const wheelScale: string = resolveTouchWheelScale(sensitivityPercent).toFixed(4);
  return `
(function(){
  window.__safeInject('touch-wheel', function(){
    var MIN_STEP = 10;
    var WHEEL_SCALE = ${wheelScale};
    var active = false;
    var lastY = 0;
    var lastX = 0;
    var accum = 0;

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

    function mid(touches) {
      var a = touches[0];
      var b = touches[1];
      return {
        x: (a.clientX + b.clientX) * 0.5,
        y: (a.clientY + b.clientY) * 0.5
      };
    }

    function wheelOpts(x, y, deltaY) {
      return {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        deltaX: 0,
        deltaY: deltaY,
        deltaZ: 0,
        deltaMode: 0
      };
    }

    function dispatchWheel(x, y, deltaY) {
      var canvas = canvasAt(x, y);
      if (!canvas) return false;
      var sent = false;
      try {
        canvas.dispatchEvent(new WheelEvent('wheel', wheelOpts(x, y, deltaY)));
        sent = true;
      } catch (_) {
        try {
          var ev = document.createEvent('WheelEvent');
          ev.initWheelEvent('wheel', true, true, window, 0, x, y, x, y, 0, null, 0, 0, deltaY, 0);
          canvas.dispatchEvent(ev);
          sent = true;
        } catch (_) {
        }
      }

      try {
        var mouseWheel = new WheelEvent('mousewheel', wheelOpts(x, y, deltaY));
        var legacyDelta = deltaY > 0 ? -120 : 120;
        try { Object.defineProperty(mouseWheel, 'wheelDelta', { value: legacyDelta, configurable: true }); } catch (_) {}
        try { Object.defineProperty(mouseWheel, 'wheelDeltaY', { value: legacyDelta, configurable: true }); } catch (_) {}
        canvas.dispatchEvent(mouseWheel);
        sent = true;
      } catch (_) {}

      try {
        var domScroll = document.createEvent('MouseEvents');
        domScroll.initMouseEvent('DOMMouseScroll', true, true, window, 0, x, y, x, y, false, false, false, false, 0, null);
        try { Object.defineProperty(domScroll, 'detail', { value: deltaY > 0 ? 1 : -1, configurable: true }); } catch (_) {}
        canvas.dispatchEvent(domScroll);
        sent = true;
      } catch (_) {}

      return sent;
    }

    function begin(e) {
      if (!e || !e.touches || e.touches.length !== 2) return false;
      var p = mid(e.touches);
      if (!canvasAt(p.x, p.y)) return false;
      active = true;
      window.__kcaTouchWheelActive = true;
      lastX = p.x;
      lastY = p.y;
      accum = 0;
      try { e.preventDefault(); } catch (_) {}
      return true;
    }

    function move(e) {
      if (!e || !e.touches || e.touches.length !== 2) {
        end();
        return;
      }
      var p = mid(e.touches);
      if (!active) {
        begin(e);
        return;
      }

      var dy = p.y - lastY;
      lastX = p.x;
      lastY = p.y;
      accum += dy;

      if (Math.abs(accum) >= MIN_STEP) {
        var deltaY = accum * WHEEL_SCALE;
        if (dispatchWheel(p.x, p.y, deltaY)) {
          accum = 0;
        }
      }
      try { e.preventDefault(); } catch (_) {}
    }

    function end() {
      active = false;
      window.__kcaTouchWheelActive = false;
      accum = 0;
    }

    window.__kcaWheelAtGamePoint = function(x, y, deltaY) {
      x = Number(x);
      y = Number(y);
      deltaY = Number(deltaY);
      if (!isFinite(x) || !isFinite(y) || !isFinite(deltaY)) return false;
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
      return dispatchWheel(r.left + x / 1200 * r.width, r.top + y / 720 * r.height, deltaY);
    };

    document.addEventListener('touchstart', begin, { capture: true, passive: false });
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, { capture: true, passive: true });
    document.addEventListener('touchcancel', end, { capture: true, passive: true });
    console.log('[touch-wheel] installed');
  });
})();
`;
}
