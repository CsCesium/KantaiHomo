export function bridgeSnippet(channelName: string, postMethod: string) {
  return `
  (function(){
    window.__safeInject('bridge', function(){
      var NAME='${channelName}', M='${postMethod}';
      var q = window.__hm_q = window.__hm_q || [];
      var sequence = 0, session = Date.now().toString(36) + Math.random().toString(36).slice(2);
      var timer = null, flushing = false;
      function schedule(){
        if (timer !== null || !q.length) return;
        timer = setTimeout(function(){ timer = null; window.__hm_flush(); }, 500);
      }
      function prepare(msg){
        try {
          var packet = JSON.parse(msg);
          if (packet && typeof packet.url === 'string' && typeof packet.responseText === 'string') {
            packet.type = 'API_DUMP';
            if (!packet.trace) packet.trace = session + ':' + (++sequence);
            return JSON.stringify(packet);
          }
        } catch(e){}
        return msg;
      }
      window.__hm_send = function(msg){
        try { msg = prepare(msg); } catch(e){}
        q.push(msg);
        window.__hm_flush();
      };
      window.__hm_ack = function(trace){
        if (!q.length) return;
        try {
          if (JSON.parse(q[0]).trace !== trace) return;
          q.shift();
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(function(){ timer = null; window.__hm_flush(); }, 0);
        } catch(e){}
      };
      window.__hm_flush = function(){
        if (flushing || !q.length) return;
        flushing = true;
        try {
          var host = window[NAME];
          if (!host || typeof host[M] !== 'function') return;
          // Later responses must never overtake a stalled port/battle/fleet update.
          while (q.length) {
            var msg = prepare(q[0]);
            q[0] = msg;
            var api = false;
            try {
              var packet = JSON.parse(msg);
              api = packet && typeof packet.url === 'string' && typeof packet.responseText === 'string';
            } catch(e){}
            host[M](msg);
            if (api) break;
            q.shift();
          }
        } catch(e) {
          console.warn('[bridge] delivery deferred:', String(e));
        } finally {
          flushing = false;
          schedule();
        }
      };
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) window.__hm_flush(); });
      window.addEventListener('pageshow', function(){ window.__hm_flush(); });
      window.addEventListener('online', function(){ window.__hm_flush(); });
      window.__hm_flush();
      console.log('[bridge] installed (ordered retry mode)');
    });
  })();`;
}
