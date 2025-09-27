import { url,util } from '@kit.ArkTS';

//reserved for future
function shouldWrap(url: string): boolean {
  if (url.length === 0) return false;
  if (/[?&]kcwrap=1(&|$)/i.test(url)) return false;           // 已包装 → 放行
  return /^https?:\/\/osapi\.dmm\.com\/gadgets\/ifr/i.test(url); // ★ 只拦 osapi
}

function buildWrapperHtml(originalUrl: string): string {
  const sep: string = originalUrl.indexOf('?') >= 0 ? '&' : '?';
  const innerUrl: string = `${originalUrl}${sep}kcwrap=1`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Kancolle Wrapper</title>
<style>
  html,body { margin:0; padding:0; background:#000; overflow:hidden; height:100vh; }
  #host { position:fixed; inset:0; width:100vw; height:100vh; border:0; display:block; background:#000; }
</style>
<script>
(function(){
  // 在 osapi 子文档里注入等效于 POI 的“Faster align setting”
  function injectIntoOsapi(doc){
    try{
      if (!doc) return false;
      var s = doc.getElementById('kc-osapi-align-style');
      if (!s) {
        s = doc.createElement('style');
        s.id = 'kc-osapi-align-style';
        s.textContent = [
          'html{overflow:hidden!important;background:#000!important;}',
          'body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;height:100vh!important;}',
          '#w,#main-ntg{position:absolute!important;top:0;left:0;z-index:100;margin:0!important;}',
          '#game_frame{width:1200px!important;position:absolute!important;top:0;left:0;border:0!important;}',
          '.naviapp{z-index:-1;}',
          '#ntg-recommend,#spacing_top{display:none!important;}',
          '#alert{left:270px!important;top:83px!important;border:0;}'
        ].join('');
        (doc.head || doc.documentElement).appendChild(s);
      }
      // 祖先链去偏移，避免整体下移
      var gf = doc.getElementById('game_frame');
      if (gf && gf.parentElement) {
        var p = gf.parentElement;
        while (p && p !== doc.body) {
          p.style.margin='0'; p.style.padding='0'; p.style.border='0';
          p.style.top='0'; p.style.left='0'; p.style.transform='none';
          p = p.parentElement;
        }
      }
      return true;
    }catch(_e){ return false; }
  }

  function arm(){
    var ifr = document.getElementById('host');
    if (!ifr) return;

    function tryDoc(){
      try{
        var d = ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document);
        if (d) injectIntoOsapi(d);
      }catch(_e){}
    }

    ifr.addEventListener('load', function(){
      tryDoc();
      try{
        var d = ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document);
        if (d) {
          var mo = new MutationObserver(function(){ injectIntoOsapi(d); });
          mo.observe(d.documentElement, { childList:true, subtree:true });
          setTimeout(function(){ injectIntoOsapi(d); }, 80);
          setTimeout(function(){ injectIntoOsapi(d); }, 300);
          setTimeout(function(){ injectIntoOsapi(d); }, 800);
        }
      }catch(_e){}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm, { once:true });
  else arm();
})();
</script>
</head>
<body>
  <iframe id="host" src="${innerUrl}" allow="autoplay; fullscreen"></iframe>
</body>
</html>`;
}
function buildHtmlResponse(html: string): WebResourceResponse {
  const encoder: util.TextEncoder = new util.TextEncoder();
  const bytes: Uint8Array = encoder.encode(html);
  const resp: WebResourceResponse = new WebResourceResponse();
  resp.setResponseCode(200);
  resp.setReasonMessage('OK');
  resp.setResponseEncoding('utf-8');
  resp.setResponseMimeType('text/html');
  resp.setResponseData(bytes);
  return resp;
}

export function kancolleInnerHtmlInterceptor(event: OnInterceptRequestEvent): WebResourceResponse | null {
  const url: string = event.request.getRequestUrl();
  const method: string = event.request.getRequestMethod();
  if (method !== 'GET') return null;
  if (!shouldWrap(url)) return null;
  return buildHtmlResponse(buildWrapperHtml(url));
}

function extractHost(url: string): string {
  const m = url.match(/^https?:\/\/([^\/?#:]+)/i);
  return m ? m[1].toLowerCase() : '';
}

export function shouldBlock(Url: string): boolean {
  let u:url.URL;
  try {
    u = url.URL.parseURL(Url);
  }catch (_){
    return false;
  }

  const host:string = u.hostname.toLowerCase();
  const path:string = (u.pathname+u.search).toLowerCase();

  const allowHosts:string[] = [
    'dmm.com', 'www.dmm.com', 'osapi.dmm.com', 'www.dmm.co.jp',
    //shall allow host or proxy
  ];

  for (let i = 0; i<allowHosts.length;i++){ if (host.endsWith(allowHosts[i])) return false}

  const blockHosts:string[] = [
    'googlesyndication.com',
    'google-analytics.com',
    'doubleclick.net',
    'pagead2.googlesyndication.com',
    'analytics.twitter.com',
    'ads-twitter.com',
    't.co',
    'bat.bing.com',
    'connect.facebook.net',
    'criteo.com',
    'taboola.com',
    'scorecardresearch.com',
    'snapads.com',
    'hotjar.com',
    'sentry.io',
    'newrelic.com'
  ];
  for (let i = 0; i<blockHosts.length;i++){if (host.endsWith(blockHosts[i])) return true;}

  if(path.indexOf('/pagead/') >= 0 ||
      path.indexOf('/adsct') >= 0 ||
      path.indexOf('gtm.js') >= 0 ||
      path.indexOf('analytics.js') >= 0 ||
      path.indexOf('collect?') >= 0 ||
      path.indexOf('pixel.gif') >= 0){
    return true;
  }
  return false;
}

export function createEmptyResp():WebResourceResponse{
  const resp = new WebResourceResponse();
  resp.setResponseCode(204);
  resp.setReasonMessage('No Content');
  resp.setResponseEncoding('utf-8');
  resp.setResponseMimeType('text/plain');
  resp.setResponseData(new Uint8Array(0));

  const headers= new Array<Header>();
  headers.push({ headerKey: 'Content-Type', headerValue: 'text/plain; charset=utf-8' });
  resp.setResponseHeader(headers);
  return resp;
}