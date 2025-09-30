export function hookFetchSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    function __kc_tryInject(tag, fn){
      try { if (typeof window.__safeInject === 'function') return window.__safeInject(tag, fn); } catch(e){}
      try { fn(); } catch(e){}
    }
    __kc_tryInject('hook-fetch', function(){
      if (!window.fetch) return;

      function __isTextLike(headers){
        try {
          var ct = (headers && (headers.get ? headers.get('content-type') : headers['content-type'])) || '';
          return /text|json|javascript|form|urlencoded/i.test(String(ct));
        } catch(e) { return true; }
      }
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
      // === 统一发送函数（不假设返回 Promise）===
      function __sendToHost(payload){
        try{
          var NAME='${channelName}', M='${postMethod}', host=window[NAME];
          if (host && typeof host[M] === 'function') {
            try { host[M](payload); console.debug('[bridge][post] ok'); return true; } catch(e){ console.warn('[bridge][post] error', e); }
          }
          if (host && typeof host.postAsync === 'function') {
            try {
              var r = host.postAsync(payload);
              if (r && typeof r.then === 'function') {
                r.then(function(){ console.debug('[bridge][postAsync] ok'); })
                 .catch(function(e){ console.warn('[bridge][postAsync] fail', e); });
              } else {
                console.debug('[bridge][postAsync] called (non-promise)');
              }
              return true;
            } catch(e){ console.warn('[bridge][postAsync] error', e); }
          }
          if (typeof window.__hm_send === 'function') {
            try { window.__hm_send(payload); console.debug('[bridge][queue] enqueue'); return true; } catch(e){ console.warn('[bridge][queue] error', e); }
          }
          (window.__hm_q = window.__hm_q || []).push(payload);
          console.debug('[bridge][queue] stash qsize=', window.__hm_q.length);
          return false;
        }catch(e){ console.warn('[bridge] send fatal', e); return false; }
      }

      var _fetch = window.fetch;
      window.fetch = function(input, init){
        try {
          var url = (typeof input === 'string') ? input : (input && input.url) || '';
          var method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
          var body = init && (init.body || init.data);
          var ok = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
          if (!ok) return _fetch(input, init);

          return _fetch(input, init).then(function(res){
            try {
              if (!__isTextLike(res.headers)) return res;
              var clone = res.clone();
              return clone.text().then(function(text){
                var req = __parseReqBody(body);
                var parsed = __parseSvdata(text);

                console.debug('[hook-fetch]', method, res.status, url);

                var payload = JSON.stringify({
                  ts: Date.now(),
                  kind: 'fetch',
                  url: url,
                  method: method,
                  status: Number(res.status) || 0,
                  requestBody: req.raw,
                  responseText: parsed.raw,
                  request:  req,
                  response: parsed
                });

                __sendToHost(payload);
                return res;
              }).catch(function(){ return res; });
            } catch(e){ return res; }
          });
        } catch(e){}
        return _fetch(input, init);
      };
      console.log('[hook-fetch] ready');
    });
  })();`;
}
