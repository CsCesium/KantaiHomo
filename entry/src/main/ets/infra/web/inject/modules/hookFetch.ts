// entry/src/main/ets/infra/web/inject/modules/hookFetch.ts
export function hookFetchSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    function __kc_tryInject(tag, fn){
      try {
        if (typeof window.__safeInject === 'function') return window.__safeInject(tag, fn);
      } catch (_) {}
      try { fn(); } catch (_) {}
    }

    __kc_tryInject('hook-fetch', function(){
      if (!window.fetch) return;

      function __isTextLike(headers){
        try {
          const ct = (headers && (headers.get ? headers.get('content-type') : headers['content-type'])) || '';
          return /text|json|javascript|form|urlencoded/i.test(String(ct));
        } catch (_) { return true; }
      }

      function __parseReqBody(body){
        try {
          if (!body) return { raw: '' };
          if (typeof body === 'string') {
            const raw = body;
            // x-www-form-urlencoded
            try { return { raw, form: Object.fromEntries(new URLSearchParams(raw).entries()) }; } catch {}
            // JSON
            const t = raw.trim();
            if (t.startsWith('{') || t.startsWith('[')) {
              try { return { raw, json: JSON.parse(raw) }; } catch {}
            }
            return { raw };
          }
          if (body instanceof URLSearchParams) return { raw: body.toString(), form: Object.fromEntries(body.entries()) };
          if (body instanceof FormData)      return { raw: '[FormData]',        form: Object.fromEntries([...body.entries()]) };
        } catch (_) {}
        return { raw: '' };
      }

      function __parseSvdata(text){
        try {
          const raw = String(text ?? '');
          const trimmed = raw.trim().replace(/^svdata=/, '');
          try { return { json: JSON.parse(trimmed), raw }; }
          catch { return { raw }; }
        } catch (_) { return { raw: String(text ?? '') }; }
      }

      const _fetch = window.fetch;
      window.fetch = function(input, init){
        try {
          const url = (typeof input === 'string') ? input : (input && input.url) || '';
          const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
          const body = init && (init.body || init.data);

          // —— 兼容正则/字符串的过滤器 —— //
          const ok = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
          if (!ok) return _fetch(input, init);

          return _fetch(input, init).then(function(res){
            try {
              if (!__isTextLike(res.headers)) return res;
              //  clone() + text()，不影响后续消费 body —— //
              const clone = res.clone(); // 允许读取一次文本
              return clone.text().then(function(text){
                const payload = JSON.stringify({
                  ts: Date.now(),
                  kind: 'fetch',
                  url,
                  method,
                  status: Number(res.status) || 0,
                  request:  __parseReqBody(body),
                  response: __parseSvdata(text)
                });
                try { window['${channelName}'] && window['${channelName}']['${postMethod}'] && window['${channelName}']['${postMethod}'](payload); } catch(e){}
                return res; // —— 把原始 Response 返回给页面 —— //
              }).catch(function(){ return res; });
            } catch (_) { return res; }
          });
        } catch (_) {}
        return _fetch(input, init);
      };

      console.log('[hook-fetch] ready');
    });
  })();`;
}
