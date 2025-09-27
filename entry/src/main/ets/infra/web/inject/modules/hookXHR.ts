// entry/src/main/ets/infra/web/inject/modules/hookXHR.ts
export function hookXhrSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    function __kc_tryInject(tag, fn){
      try {
        if (typeof window.__safeInject === 'function') return window.__safeInject(tag, fn);
      } catch (_) {}
      try { fn(); } catch (_) {}
    }

    __kc_tryInject('hook-xhr', function(){
      function __parseReqBody(body){
        try {
          if (!body) return { raw: '' };
          if (typeof body === 'string') {
            const raw = body;
            try { return { raw, form: Object.fromEntries(new URLSearchParams(raw).entries()) }; } catch {}
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

      const open = XMLHttpRequest.prototype.open;
      const send = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url){
        try { this.__kc = { m: (method || 'GET').toUpperCase(), u: String(url || '') }; } catch(e){}
        return open.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body){
        const xhr = this;
        try { if (xhr.__kc) xhr.__kc.req = __parseReqBody(body); } catch(e){}

        xhr.addEventListener('readystatechange', function(){
          try {
            if (xhr.readyState !== 4) return; // DONE（完成，无论成功或失败） :contentReference[oaicite:3]{index=3}

            const url = xhr.responseURL || (xhr.__kc && xhr.__kc.u) || ''; // :contentReference[oaicite:4]{index=4}

            const ok = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
            if (!ok) return;

            // 失败/中断的场景：readyState=4, status 可能为 0（例如网络错误/abort），需容忍 —— //
            //status 为 0 并不代表未到 DONE，仅表示失败/被阻断。:contentReference[oaicite:5]{index=5}
            const text = (typeof xhr.responseText === 'string') ? xhr.responseText : '';
            const payload = JSON.stringify({
              ts: Date.now(),
              kind: 'xhr',
              url: url,
              method: (xhr.__kc && xhr.__kc.m) || 'GET',
              status: Number(xhr.status) || 0,
              request:  (xhr.__kc && xhr.__kc.req) || { raw: '' },
              response: __parseSvdata(text)
            });
            try { window['${channelName}'] && window['${channelName}']['${postMethod}'] && window['${channelName}']['${postMethod}'](payload); } catch(e){}
          } catch(e){}
        });

        return send.apply(this, arguments);
      };

      console.log('[hook-xhr] ready');
    });
  })();`;
}
