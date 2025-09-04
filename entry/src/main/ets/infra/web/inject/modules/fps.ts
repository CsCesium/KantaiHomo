export function fpsSnippet(channelName: string, postMethod: string) {
  return `
  (function(){
    window.__safeInject('fps', function(){
      const times = []; let last = -1;
      function loop(){
        requestAnimationFrame(function(){
          const now = performance.now();
          while (times.length && times[0] <= now - 1000) times.shift();
          times.push(now);
          if (times.length !== last) {
            last = times.length;
            try { window['${channelName}']['${postMethod}'](JSON.stringify({ type:'FPS', value:last })); } catch(e){}
          }
          loop();
        });
      }
      loop();
      console.log('[fps] ready');
    });
  })();`;
}