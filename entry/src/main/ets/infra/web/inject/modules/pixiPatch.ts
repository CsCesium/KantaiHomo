//TODO: 可选实现？
export const pixiPatchSnippet = `
(function(){
  window.__safeInject('pixi-spritesheet-patch', function(){
    function run(){
      try {
        if (!window.PIXI || !PIXI.Spritesheet) return false;
        // === PATCH_BODY_START ===
        // === PATCH_BODY_END ===
        console.log('[pixi-patch] applied');
        return true;
      } catch(e){ console.warn('[pixi-patch] failed:', e); return false; }
    }
    if (!run()) {
      const timer = setInterval(function(){ if (run()) clearInterval(timer); }, 500);
    }
  });
})();
`;