export function hookFetchSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    window.__safeInject('hook-fetch', function(){
      if (!window.fetch) return;
      const _fetch = window.fetch;
      window.fetch = function(input, init){
        try {
          const url = (typeof input === 'string') ? input : (input && input.url) || '';
          const body = init && (init.body || init.data);
          const shouldLog = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
          if (shouldLog) {
            return _fetch(input, init).then(function(res){
              try {
                const clone = res.clone();
                return clone.text().then(function(text){
                  const payload = JSON.stringify({ url, requestBody: body ? String(body) : '', responseText: text });
                  try { window['${channelName}']['${postMethod}'](payload); } catch(e){}
                  return res;
                }).catch(function(){ return res; });
              } catch(e){ return res; }
            });
          }
        } catch(e){}
        return _fetch(input, init);
      };
      console.log('[hook-fetch] ready');
    });
  })();`;
}