export const touchPatchSnippet = `
(function(){
  window.__safeInject('touch-patch', function(){
    function apply(){
      try {
        if (!window.PIXI || !PIXI.interaction || !PIXI.interaction.InteractionManager) return false;
        const proto = PIXI.interaction.InteractionManager.prototype;
        if (proto.__patched_touch_over) return true;
        proto.__patched_touch_over = true;

        let moved = false;
        const oldMove = proto.onTouchMove;
        proto.onTouchMove = function(){ moved = true; return oldMove.apply(this, arguments); };

        const oldUpdate = proto.update;
        proto.update = function(dt){
          if (moved) { moved = false; return; }
          return oldUpdate.apply(this, arguments);
        };

        console.log('[touch-patch] applied');
        return true;
      } catch(e){ return false; }
    }
    if (!apply()) {
      // PIXI 可能稍后加载，轮询一次
      const timer = setInterval(function(){
        if (apply()) clearInterval(timer);
      }, 300);
    }
  });
})();
`;