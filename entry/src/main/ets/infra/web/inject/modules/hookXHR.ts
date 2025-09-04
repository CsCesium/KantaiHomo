export function hookXhrSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    window.__safeInject('hook-xhr', function(){
      const open = XMLHttpRequest.prototype.open;
      const send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url){
        try { this.__u = url; } catch(e){}
        return open.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body){
        const xhr = this;
        try {
          xhr.addEventListener('readystatechange', function(){
            try {
              if (xhr.readyState !== 4) return;
              const url = xhr.responseURL || xhr.__u || '';
              if (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url)) {
                const payload = JSON.stringify({
                  url: url,
                  requestBody: body ? String(body) : '',
                  responseText: xhr.responseText
                });
                try { window['${channelName}']['${postMethod}'](payload); } catch(e){}
              }
            } catch(e){}
          });
        } catch(e){}
        return send.apply(this, arguments);
      };
      console.log('[hook-xhr] ready');
    });
  })();`;
}