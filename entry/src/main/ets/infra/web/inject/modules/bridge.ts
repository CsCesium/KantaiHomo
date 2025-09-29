export function bridgeSnippet(channelName: string, postMethod: string) {
  return `
  (function(){
    window.__safeInject('bridge', function(){
      var NAME='${channelName}', M='${postMethod}';
      if (!Array.isArray(window.__hm_q)) { window.__hm_q = []; }

      if (typeof window.__hm_ack !== 'function') {
        window.__hm_ack = function(id){ try{ console.info('[ACK]', id); }catch(_){ } };
      }
      function __traceOf(msg){
        try { var o = JSON.parse(msg); return (o && o.trace) ? String(o.trace) : ''; } catch(_){ return ''; }
      }

      window.__hm_send = function(msg){
        try{
          var ok = window[NAME] && typeof window[NAME][M] === 'function';
          if (ok) {
            console.debug('[bridge][SEND]', __traceOf(msg), 'len=', (msg && msg.length) ? msg.length : 0);
            window[NAME][M](msg);
            return;
          }
          window.__hm_q.push(msg);
          console.debug('[bridge][Q]', __traceOf(msg), 'len=', (msg && msg.length) ? msg.length : 0, 'qsize=', window.__hm_q.length);
        }catch(_){}
      };

      window.__hm_flush = function(){
        try{
          var ok = window[NAME] && typeof window[NAME][M] === 'function';
          if (!ok) return;
          var q = window.__hm_q; window.__hm_q = [];
          console.debug('[bridge][FLUSH]', q.length);
          for (var i=0;i<q.length;i++){
            try{
              console.debug('[bridge][SEND]', __traceOf(q[i]));
              window[NAME][M](q[i]);
            }catch(_){}
          }
          console.log('[bridge] proxy-ready; delivered=', q.length);
        }catch(_){}
      };

      (function poll(){
        try{
          var ok = window[NAME] && typeof window[NAME][M] === 'function';
          if (ok) { window.__hm_flush(); return; }
        }catch(_){}
        setTimeout(poll, 200);
      })();

      console.log('[bridge] installed (queue mode)');
    });
  })();`;
}
