export const audioMuteSnippet = `
(function(){
  window.__safeInject('kc-audio-mute', function(){
    var ROOT = window;
    var STATE_KEY = '__kcHostAudioMuted';
    var INSTALL_KEY = '__kcAudioMuteInstalled';
    var TIMER_KEY = '__kcAudioMuteTimer';

    function ignorePromise(p){
      try {
        if (p && typeof p.catch === 'function') p.catch(function(){});
      } catch(e){}
    }

    function rememberContext(win, ctx){
      if (!ctx) return ctx;
      var list = win.__kcAudioContexts || (win.__kcAudioContexts = []);
      if (list.indexOf(ctx) < 0) list.push(ctx);
      if (ROOT[STATE_KEY] === true || win[STATE_KEY] === true) {
        applyContext(ctx, true);
      }
      return ctx;
    }

    function patchAudioContext(win){
      var names = ['AudioContext', 'webkitAudioContext'];
      for (var i = 0; i < names.length; i++) {
        try {
          var name = names[i];
          var Original = win[name];
          if (typeof Original !== 'function' || Original.__kcAudioMuteWrapped) continue;
          var Wrapped = function(){
            var args = Array.prototype.slice.call(arguments);
            var Bound = Function.prototype.bind.apply(Original, [null].concat(args));
            return rememberContext(win, new Bound());
          };
          Wrapped.prototype = Original.prototype;
          try { Object.setPrototypeOf(Wrapped, Original); } catch(e){}
          try { Object.defineProperty(Wrapped, '__kcAudioMuteWrapped', { value: true }); } catch(e){}
          win[name] = Wrapped;
        } catch(e){}
      }
    }

    function applyContext(ctx, muted){
      try {
        if (!ctx || typeof ctx.suspend !== 'function' || typeof ctx.resume !== 'function') return;
        if (muted) {
          if (ctx.state === 'closed') return;
          ctx.__kcHostSuspended = true;
          if (ctx.state !== 'suspended') ignorePromise(ctx.suspend());
          return;
        }
        if (ctx.__kcHostSuspended) {
          ctx.__kcHostSuspended = false;
          if (ctx.state === 'suspended') ignorePromise(ctx.resume());
        }
      } catch(e){}
    }

    function applyGainNode(node, muted){
      try {
        var param = node && (node.gain || node);
        if (!param || typeof param.value !== 'number') return;
        if (muted) {
          if (typeof param.__kcHostGainBefore === 'undefined') {
            param.__kcHostGainBefore = param.value;
          }
          param.value = 0;
        } else if (typeof param.__kcHostGainBefore === 'number') {
          param.value = param.__kcHostGainBefore;
          try { delete param.__kcHostGainBefore; } catch(e){ param.__kcHostGainBefore = undefined; }
        }
      } catch(e){}
    }

    function applyMediaElement(el, muted){
      try {
        if (!el) return;
        if (muted) {
          if (typeof el.__kcHostMutedBefore === 'undefined') {
            el.__kcHostMutedBefore = !!el.muted;
          }
          if (typeof el.__kcHostVolumeBefore === 'undefined' && typeof el.volume === 'number') {
            el.__kcHostVolumeBefore = el.volume;
          }
          try { el.muted = true; } catch(e){}
          try { el.volume = 0; } catch(e){}
          return;
        }
        if (typeof el.__kcHostMutedBefore !== 'undefined') {
          try { el.muted = !!el.__kcHostMutedBefore; } catch(e){}
          try { delete el.__kcHostMutedBefore; } catch(e){ el.__kcHostMutedBefore = undefined; }
        }
        if (typeof el.__kcHostVolumeBefore === 'number') {
          try { el.volume = el.__kcHostVolumeBefore; } catch(e){}
          try { delete el.__kcHostVolumeBefore; } catch(e){ el.__kcHostVolumeBefore = undefined; }
        }
      } catch(e){}
    }

    function patchMediaPlay(win){
      try {
        var proto = win.HTMLMediaElement && win.HTMLMediaElement.prototype;
        if (!proto || proto.__kcAudioMutePlayPatched || typeof proto.play !== 'function') return;
        var original = proto.play;
        proto.play = function(){
          if (ROOT[STATE_KEY] === true || win[STATE_KEY] === true) {
            applyMediaElement(this, true);
          }
          return original.apply(this, arguments);
        };
        try { Object.defineProperty(proto, '__kcAudioMutePlayPatched', { value: true }); } catch(e){}
      } catch(e){}
    }

    function applyMedia(win, muted){
      try {
        if (!win.document || typeof win.document.querySelectorAll !== 'function') return;
        var nodes = win.document.querySelectorAll('audio,video');
        for (var i = 0; i < nodes.length; i++) applyMediaElement(nodes[i], muted);
      } catch(e){}
    }

    function collectKnownContexts(win){
      try {
        var knownNames = ['audioContext', 'audioCtx', 'kcDebugAudio'];
        for (var i = 0; i < knownNames.length; i++) {
          var ctx = win[knownNames[i]];
          if (ctx && typeof ctx.suspend === 'function' && typeof ctx.resume === 'function') {
            rememberContext(win, ctx);
          }
        }
      } catch(e){}
      try {
        var sound = win.createjs && win.createjs.Sound;
        var plugin = sound && sound.activePlugin;
        if (plugin && plugin.context) rememberContext(win, plugin.context);
        if (plugin && plugin.gainNode && plugin.gainNode.context) rememberContext(win, plugin.gainNode.context);
        var webAudioPlugin = win.createjs && win.createjs.WebAudioPlugin;
        if (webAudioPlugin && webAudioPlugin.context) rememberContext(win, webAudioPlugin.context);
      } catch(e){}
      try {
        var howler = win.Howler;
        if (howler && howler.ctx) rememberContext(win, howler.ctx);
      } catch(e){}
    }

    function applySoundJs(win, muted){
      try {
        var sound = win.createjs && win.createjs.Sound;
        if (!sound) return;
        if (muted) {
          if (typeof sound.__kcHostMutedBefore === 'undefined') sound.__kcHostMutedBefore = !!sound.muted;
          if (typeof sound.__kcHostVolumeBefore === 'undefined' && typeof sound.volume === 'number') {
            sound.__kcHostVolumeBefore = sound.volume;
          }
          if (typeof sound.setMute === 'function') sound.setMute(true);
          else sound.muted = true;
          if (typeof sound.volume === 'number') sound.volume = 0;
        } else {
          if (typeof sound.__kcHostMutedBefore !== 'undefined') {
            var nextMuted = !!sound.__kcHostMutedBefore;
            if (typeof sound.setMute === 'function') sound.setMute(nextMuted);
            else sound.muted = nextMuted;
            try { delete sound.__kcHostMutedBefore; } catch(e){ sound.__kcHostMutedBefore = undefined; }
          }
          if (typeof sound.__kcHostVolumeBefore === 'number') {
            sound.volume = sound.__kcHostVolumeBefore;
            try { delete sound.__kcHostVolumeBefore; } catch(e){ sound.__kcHostVolumeBefore = undefined; }
          }
        }
        var plugin = sound.activePlugin;
        if (plugin && plugin.gainNode) applyGainNode(plugin.gainNode, muted);
      } catch(e){}
    }

    function applyHowler(win, muted){
      try {
        var howler = win.Howler;
        if (!howler) return;
        if (muted) {
          if (typeof howler.__kcHostMutedBefore === 'undefined') howler.__kcHostMutedBefore = !!howler._muted;
          if (typeof howler.volume === 'function' && typeof howler.__kcHostVolumeBefore === 'undefined') {
            howler.__kcHostVolumeBefore = howler.volume();
          }
          if (typeof howler.mute === 'function') howler.mute(true);
          if (typeof howler.volume === 'function') howler.volume(0);
        } else {
          if (typeof howler.__kcHostMutedBefore !== 'undefined') {
            if (typeof howler.mute === 'function') howler.mute(!!howler.__kcHostMutedBefore);
            try { delete howler.__kcHostMutedBefore; } catch(e){ howler.__kcHostMutedBefore = undefined; }
          }
          if (typeof howler.volume === 'function' && typeof howler.__kcHostVolumeBefore === 'number') {
            howler.volume(howler.__kcHostVolumeBefore);
            try { delete howler.__kcHostVolumeBefore; } catch(e){ howler.__kcHostVolumeBefore = undefined; }
          }
        }
      } catch(e){}
    }

    function applyPixiSound(win, muted){
      try {
        var pixiSound = win.PIXI && win.PIXI.sound;
        if (!pixiSound) return;
        if (muted) {
          if (typeof pixiSound.__kcHostMutedBefore === 'undefined') pixiSound.__kcHostMutedBefore = !!pixiSound.muted;
          if (typeof pixiSound.__kcHostVolumeBefore === 'undefined' && typeof pixiSound.volumeAll === 'number') {
            pixiSound.__kcHostVolumeBefore = pixiSound.volumeAll;
          }
          pixiSound.muted = true;
          if (typeof pixiSound.volumeAll === 'number') pixiSound.volumeAll = 0;
        } else {
          if (typeof pixiSound.__kcHostMutedBefore !== 'undefined') {
            pixiSound.muted = !!pixiSound.__kcHostMutedBefore;
            try { delete pixiSound.__kcHostMutedBefore; } catch(e){ pixiSound.__kcHostMutedBefore = undefined; }
          }
          if (typeof pixiSound.__kcHostVolumeBefore === 'number') {
            pixiSound.volumeAll = pixiSound.__kcHostVolumeBefore;
            try { delete pixiSound.__kcHostVolumeBefore; } catch(e){ pixiSound.__kcHostVolumeBefore = undefined; }
          }
        }
      } catch(e){}
    }

    function observeDocument(win){
      try {
        if (win.__kcAudioMuteObserver || !win.MutationObserver || !win.document) return;
        var target = win.document.documentElement || win.document;
        var observer = new win.MutationObserver(function(){
          if (ROOT[STATE_KEY] === true) applyAll(true);
        });
        observer.observe(target, { childList: true, subtree: true });
        win.__kcAudioMuteObserver = observer;
      } catch(e){}
    }

    function installInWindow(win){
      try {
        if (!win || win[INSTALL_KEY]) return;
        try { Object.defineProperty(win, INSTALL_KEY, { value: true, configurable: true }); } catch(e){ win[INSTALL_KEY] = true; }
        win.__kcSetAudioMuted = ROOT.__kcSetAudioMuted;
        patchAudioContext(win);
        patchMediaPlay(win);
        observeDocument(win);
        collectKnownContexts(win);
      } catch(e){}
    }

    function walkFrames(win, fn){
      try { fn(win); } catch(e){}
      try {
        var frames = win.frames;
        for (var i = 0; i < frames.length; i++) {
          try { walkFrames(frames[i], fn); } catch(e){}
        }
      } catch(e){}
    }

    function applyInWindow(win, muted){
      try {
        win[STATE_KEY] = muted;
        installInWindow(win);
        collectKnownContexts(win);
        applyMedia(win, muted);
        applySoundJs(win, muted);
        applyHowler(win, muted);
        applyPixiSound(win, muted);
        var list = win.__kcAudioContexts || [];
        for (var i = 0; i < list.length; i++) applyContext(list[i], muted);
      } catch(e){}
    }

    function applyAll(muted){
      ROOT[STATE_KEY] = muted === true;
      walkFrames(ROOT, function(win){
        applyInWindow(win, ROOT[STATE_KEY]);
      });
    }

    ROOT.__kcSetAudioMuted = function(muted){
      applyAll(muted === true);
    };

    applyAll(ROOT[STATE_KEY] === true);

    if (!ROOT[TIMER_KEY]) {
      ROOT[TIMER_KEY] = setInterval(function(){
        applyAll(ROOT[STATE_KEY] === true);
      }, 1000);
    }
  });
})();
`;

export function buildAudioMuteCommand(muted: boolean): string {
  return "(function(){try{window.__kcHostAudioMuted=" + (muted ? "true" : "false") +
    ";if(typeof window.__kcSetAudioMuted==='function'){window.__kcSetAudioMuted(" +
    (muted ? "true" : "false") + ");}}catch(e){}})();";
}
