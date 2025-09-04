export function bridgeSnippet(channelName: string, postMethod: string) {
  return `
  (function(){
    window.__safeInject('bridge', function(){
      // if ArkWeb registered registerJavaScriptProxy(window.${channelName})，nop
      if (window['${channelName}'] && typeof window['${channelName}']['${postMethod}'] === 'function') {
        console.log('[bridge] using JSProxy: window.${channelName}.${postMethod}');
        return;
      }
      // regress bridge（opt）： postMessage；Ark listening onMessage -> forward
      if (!window['${channelName}']) window['${channelName}'] = {};
      window['${channelName}']['${postMethod}'] = function(msg){
        try {
          window.postMessage(JSON.stringify({ type: 'APP_CHANNEL', payload: msg }), '*');
        } catch(e){}
      };
      console.log('[bridge] fallback via postMessage: window.${channelName}.${postMethod}');
    });
  })();`;
}