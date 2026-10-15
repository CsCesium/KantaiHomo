export function hookXhrSnippet(channelName: string, postMethod: string, apiFilter: string) {
  const filterExp = apiFilter.startsWith('/') ? apiFilter : JSON.stringify(apiFilter);

  return `
  (function(){
    function __kc_tryInject(tag, fn){
      try { if (typeof window.__safeInject === 'function') return window.__safeInject(tag, fn); } catch(e){}
      try { fn(); } catch(e){}
    }

    __kc_tryInject('hook-xhr', function(){

      var MAX_RES_LEN = 14 * 1024 * 1024; // 14MB — api_start2/getData 可达 8-12MB
      var MAX_REQ_LEN = 50 * 1024;

      var SKIP = [];

      function __shouldSkip(url){
        for (var i=0;i<SKIP.length;i++){
          if (url.indexOf(SKIP[i]) >= 0) return true;
        }
        return false;
      }

      function __stripSvdata(text){
        try{
          var raw = String(text == null ? '' : text);
          if (raw.indexOf('svdata=') === 0) return raw.slice(7);
          return raw;
        } catch(e){
          return '';
        }
      }

      function __parseReqRaw(body){
        try {
          if (!body) return '';
          if (typeof body === 'string') return body;
          if (body instanceof URLSearchParams) return body.toString();
          return '';
        } catch(e){
          return '';
        }
      }

      function __sendToHost(payload){
        try{
          if (typeof window.__hm_send === 'function') {
            window.__hm_send(payload);
            return true;
          }
          // fallback：stash queue
          (window.__hm_q = window.__hm_q || []).push(payload);
          console.debug('[bridge][queue] stash qsize=', window.__hm_q.length);
          return false;
        }catch(e){
          console.warn('[bridge] send fatal', e);
          return false;
        }
      }

      var open = XMLHttpRequest.prototype.open;
      var send = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url){
        try { this.__kc = { m: (method || 'GET').toUpperCase(), u: String(url || '') }; } catch(e){}
        return open.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body){
        var xhr = this;
        try { if (xhr.__kc) xhr.__kc.reqRaw = __parseReqRaw(body); } catch(e){}

        var request = xhr.__kc;
        var completed = function(){
          try {
            if (xhr.readyState !== 4) return;
            xhr.removeEventListener('readystatechange', completed);
            if (xhr.status < 200 || xhr.status >= 300) return;

            var url = xhr.responseURL || (request && request.u) || '';
            if (!url) return;

            var ok = (!(${filterExp}).test ? (url.indexOf(${filterExp}) !== -1) : (${filterExp}).test(url));
            if (!ok) return;

            if (__shouldSkip(url)) return;

            var reqRaw = (request && request.reqRaw) ? request.reqRaw : '';
            if (reqRaw.length > MAX_REQ_LEN) reqRaw = ''; // 太大也不传

            var text = (typeof xhr.responseText === 'string') ? xhr.responseText : '';
            var resLen = text.length;

            if (resLen > MAX_RES_LEN) {
              console.debug('[hook-xhr] skip large', resLen, url);
              return;
            }

            var resp = __stripSvdata(text);

            console.debug('[hook-xhr]', (request && request.m) || 'GET', xhr.status, url);

            var dump = JSON.stringify({
              type: 'API_DUMP',
              url: url,
              requestBody: reqRaw,
              responseText: resp
            });

            __sendToHost(dump);

          } catch(e) {}
        };
        xhr.addEventListener('readystatechange', completed);

        return send.apply(this, arguments);
      };

      console.log('[hook-xhr] ready');
    });
  })();`;
}
