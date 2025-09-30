export function hookXhrSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    function __kc_tryInject(tag, fn){
      try { if (typeof window.__safeInject === 'function') return window.__safeInject(tag, fn); } catch(e){}
      try { fn(); } catch(e){}
    }
    __kc_tryInject('hook-xhr', function(){
      function __parseReqBody(body){
        try {
          if (!body) return { raw: '' };
          if (typeof body === 'string') {
            var raw = body, t = raw.trim();
            try { return { raw: raw, form: Object.fromEntries(new URLSearchParams(raw).entries()) }; } catch(e){}
            if (t.startsWith('{') || t.startsWith('[')) { try { return { raw: raw, json: JSON.parse(raw) }; } catch(e){} }
            return { raw: raw };
          }
          if (body instanceof URLSearchParams) return { raw: body.toString(), form: Object.fromEntries(body.entries()) };
          if (body instanceof FormData)      return { raw: '[FormData]',        form: Object.fromEntries([].slice.call(body.entries())) };
        } catch(e){}
        return { raw: '' };
      }
      function __parseSvdata(text){
        try {
          var raw = String(text == null ? '' : text);
          var trimmed = raw.trim().replace(/^svdata=/, '');
          try { return { json: JSON.parse(trimmed), raw: raw }; } catch(e){ return { raw: raw }; }
        } catch(e){ return { raw: String(text == null ? '' : text) }; }
      }
      function __mkTrace(){
        try{
          var t = Date.now().toString(36);
          var r = Math.floor(Math.random()*1e9).toString(36);
          return t + '-' + r;
        }catch(e){ return String(Date.now()); }
      }

      var open = XMLHttpRequest.prototype.open;
      var send = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url){
        try { this.__kc = { m: (method || 'GET').toUpperCase(), u: String(url || '') }; } catch(e){}
        return open.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body){
        var xhr = this;
        try { if (xhr.__kc) xhr.__kc.req = __parseReqBody(body); } catch(e){}

        xhr.addEventListener('readystatechange', function(){
          try {
            if (xhr.readyState !== 4) return;
            var url = xhr.responseURL || (xhr.__kc && xhr.__kc.u) || '';
            var ok = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
            if (!ok) return;

            var text = (typeof xhr.responseText === 'string') ? xhr.responseText : '';
            var parsed = __parseSvdata(text);

            var trace = __mkTrace();
            console.debug('[TX][xhr]', trace, (xhr.__kc && xhr.__kc.m) || 'GET', Number(xhr.status)||0, url);

            var payload = JSON.stringify({
              type: 'API_DUMP',
              ts: Date.now(),
              trace: trace,
              kind: 'xhr',
              url: url,
              method: (xhr.__kc && xhr.__kc.m) || 'GET',
              status: Number(xhr.status) || 0,
              requestBody: (xhr.__kc && xhr.__kc.req && xhr.__kc.req.raw) ? xhr.__kc.req.raw : '',
              responseText: parsed.raw,
              request:  (xhr.__kc && xhr.__kc.req) || { raw: '' },
              response: parsed
            });

            try {
              if (window['${channelName}'] && typeof window['${channelName}']['postAsync'] === 'function') {
                window['${channelName}']['postAsync'](payload)
                  .then(function(){ console.debug('[bridge][postAsync] ok', trace); })
                  .catch(function(e){ console.warn('[bridge][postAsync] fail', trace, e); });
              } else if (window['${channelName}'] && typeof window['${channelName}']['${postMethod}'] === 'function') {
                window['${channelName}']['${postMethod}'](payload);
                console.debug('[bridge][post] ok', trace);
              } else if (typeof window.__hm_send === 'function') {
                console.debug('[bridge][queue] enqueue', trace);
                window.__hm_send(payload);
              } else {
                (window.__hm_q = window.__hm_q || []).push(payload);
                console.debug('[bridge][queue] stash', trace, 'qsize=', window.__hm_q.length);
              }
            } catch(e){
              console.warn('[bridge] send error', e);
            }
          } catch(e){}
        });

        return send.apply(this, arguments);
      };
      console.log('[hook-xhr] ready');
    });
  })();`;
}
