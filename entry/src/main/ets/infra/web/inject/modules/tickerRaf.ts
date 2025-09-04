export const tickerRafSnippet = `
(function(){
  window.__safeInject('ticker-raf', function(){
    try {
      if (!window.createjs || !createjs.Ticker) return;
      if (createjs.Ticker.timingMode !== createjs.Ticker.RAF) {
        createjs.Ticker.timingMode = createjs.Ticker.RAF;
        console.log('[ticker-raf] createjs.Ticker -> RAF');
      }
    } catch(e){}
  });
})();
`;