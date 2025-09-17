export function hookXhrSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    window.__safeInject('hook-xhr', function(){
      const open = XMLHttpRequest.prototype.open;
      const send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url){
        try { this.__u = url; this.__m = method || 'GET'; } catch(e){}
        return open.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body){
        const xhr = this;
        try {
          xhr.addEventListener('readystatechange', function(){
            try {
              if (xhr.readyState !== 4) return;
              const url = xhr.responseURL || xhr.__u || '';
              const ok = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
              if (!ok) return;
              const payload = JSON.stringify({
                ts: Date.now(),
                url: url,
                method: (xhr.__m || 'GET').toUpperCase(),
                status: Number(xhr.status) || 0,
                requestBody: body ? String(body) : '',
                responseText: (typeof xhr.responseText === 'string') ? xhr.responseText : ''
              });
              try { window['${channelName}']['${postMethod}'](payload); } catch(e){}
            } catch(e){}
          });
        } catch(e){}
        return send.apply(this, arguments);
      };
      console.log('[hook-xhr] ready');
    });
  })();`;
}