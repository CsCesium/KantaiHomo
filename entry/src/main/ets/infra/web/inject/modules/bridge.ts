export function bridgeSnippet(channelName: string, postMethod: string) {
  return `
  (function(){
    // - proxy 未就绪：消息进队 window.__hm_q
    // - proxy 就绪：flush 队列并后续直发
    window.__safeInject('bridge', function(){
      var NAME='${channelName}', M='${postMethod}';
      if (!Array.isArray(window.__hm_q)) { window.__hm_q = []; }

      // 单点发送：优先走 JSProxy；未就绪则排队
      window.__hm_send = function(msg){
        try{
          var ok = window[NAME] && typeof window[NAME][M] === 'function';
          if (ok) { window[NAME][M](msg); return; }
          window.__hm_q.push(msg);
          console.debug('[bridge] queued', window.__hm_q.length);
        }catch(e){}
      };

      // flush
      window.__hm_flush = function(){
        try{
          var ok = window[NAME] && typeof window[NAME][M] === 'function';
          if (!ok) return;
          var q = window.__hm_q; window.__hm_q = [];
          console.debug('[bridge] flushing', q.length);
          for (var i=0;i<q.length;i++){ try{ window[NAME][M](q[i]); }catch(e){} }
          console.log('[bridge] proxy-ready; delivered=', q.length);
        }catch(e){}
      };

      // 轮询探测 proxy
      (function poll(){
        try{
          var ok = window[NAME] && typeof window[NAME][M] === 'function';
          if (ok) { window.__hm_flush(); return; }
        }catch(e){}
        setTimeout(poll, 200);
      })();

      console.log('[bridge] installed (queue mode)');
    });
  })();`;
}