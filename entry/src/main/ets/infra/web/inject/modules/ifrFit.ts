export const iframeFitSnippet = `
window.__safeInject('iframeFit.v5', function () {
  var W = 1200, H = 720;
  var STYLE_ALIGN_ID = 'kc-align';
  var STYLE_FIT_ID   = 'kc-fit';
  var policy = 'auto'; // height | width | auto

  function ensureStyle(id){ var el=document.getElementById(id); if(!el){ el=document.createElement('style'); el.id=id; document.head.appendChild(el);} return el; }
  function findGameIframe(){
    var f=document.querySelector('#game_frame'); if(f) return f;
    var list=document.querySelectorAll('iframe');
    for(var i=0;i<list.length;i++){ var n=list[i]; var src=n.getAttribute('src')||n.getAttribute('data-src')||''; if(/kcs|osapi\\.dmm\\.com|854854/.test(src)||/kcs/.test(n.id)) return n; }
    return null;
  }
  function isolateIframePath(ifr){
    var node=ifr;
    while(node && node!==document.body){
      var p=node.parentElement; if(!p) break;
      var kids=p.children;
      for(var i=0;i<kids.length;i++){ var k=kids.item(i); if(k!==node) k.style.setProperty('display','none','important'); }
      p.style.setProperty('margin','0','important');
      p.style.setProperty('padding','0','important');
      p.style.setProperty('border','0','important');
      node=p;
    }
  }
  function applyAlignCSS(){
    var s=ensureStyle(STYLE_ALIGN_ID);
    s.textContent =
      'html{overflow:hidden!important;background:#000!important;height:100%!important}' +
      'body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;height:100%!important}' +
      '#game_frame{position:absolute!important;top:0!important;left:0!important;width:'+W+'px!important;height:'+H+'px!important;border:0!important;background:transparent!important;z-index:9999!important}';
  }
  function computeScale(vw,vh){
    if (policy==='height') return vh/H;      // 纵向占满
    if (policy==='width')  return vw/W;      // 横向占满
    return (vw>=vh) ? (vh/H) : (vw/W);       // auto：横屏→按高，竖屏→按宽
  }
  // ★ 这里按你的要求设置偏移
  function computeOffsets(vw,vh,scale){
    var cw=W*scale, ch=H*scale;
    var x=0, y=0;
    if (policy==='height' || (policy==='auto' && vw>=vh)) {
      // 横屏：水平居中、顶对齐（不留上边）
      x = Math.max(0, (vw - cw) / 2);
      y = 0;
    } else {
      // 竖屏：横向占满，顶对齐（y=0），不留上边空白
      x = 0;
      y = 0;
    }
    return { x: x, y: y };
  }
  function writeFitCSS(vw,vh,scale,off){
    var s=ensureStyle(STYLE_FIT_ID);
    s.textContent =
      'body{height:'+ vh +'px !important}' +
      '#game_frame{transform-origin:0 0!important;transform:translate('+off.x+'px,'+off.y+'px) scale('+scale+') translateZ(0)!important;will-change:transform!important}';
  }
  function applyInline(ifr,scale,off){
    ifr.style.position='absolute'; ifr.style.top='0px'; ifr.style.left='0px';
    ifr.style.width=W+'px'; ifr.style.height=H+'px';
    ifr.style.border='0'; ifr.style.background='transparent';
    ifr.style.transformOrigin='0 0';
    ifr.style.transform='translate('+off.x+'px,'+off.y+'px) scale('+scale+') translateZ(0)';
  }
  function mountOrReflow(){
    var ifr=findGameIframe(); if(!ifr) return false;
    var vw=window.innerWidth, vh=window.innerHeight;
    var sc=computeScale(vw,vh);
    var off=computeOffsets(vw,vh,sc);
    writeFitCSS(vw,vh,sc,off);
    applyInline(ifr,sc,off);
    return true;
  }
  function mountOnce(){
    var ifr=findGameIframe(); if(!ifr) return false;
    applyAlignCSS(); isolateIframePath(ifr);
    return mountOrReflow();
  }
  function run(){
    if (mountOnce()){
      var rf=function(){ mountOrReflow(); };
      window.addEventListener('resize', rf);
      window.addEventListener('orientationchange', rf);
      document.addEventListener('visibilitychange', function(){ if(!document.hidden) rf(); });
      return;
    }
    var mo=new MutationObserver(function(){ if(mountOnce()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList:true, subtree:true });
    var end=Date.now()+10000, t=setInterval(function(){ if(mountOnce()||Date.now()>end) clearInterval(t); }, 400);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', run, { once:true });
  else run();

  // 外部控制
  window.kcFitReflow = function(){ mountOrReflow(); };
  window.kcFitSetPolicy = function(p){ if(p==='height'||p==='width'||p==='auto'){ policy=p; mountOrReflow(); } };
});
//# sourceURL=hm-inject://iframeFit.js
`;