export function yasenDetectorJS():string{
  return `
  (() => {
    const YES_TEX = new Set(['battle_main_49']); // 夜戦突入
    const NO_TEX  = new Set(['battle_main_9']);  // 追撃せず

    const isSprite = n => window.PIXI && n instanceof PIXI.Sprite;
    function texId(n){
      try{
        const t=n.texture; if(!t) return '';
        if (t.textureCacheIds?.length) return t.textureCacheIds[0]||'';
        return t.baseTexture?.resource?.url || '';
      }catch{return '';}
    }
    function visibleChain(n){
      let cur=n, hop=0;
      while(cur && hop++<12){ if(cur.visible===false) return false; cur=cur.parent; }
      return true;
    }
    function climbRoot(n){ let cur=n; for(let i=0;i<1000 && cur?.parent;i++) cur=cur.parent; return cur||n; }
    function commonAncestor(a,b,cap=8){
      if(!a||!b) return null;
      const seen=new Set(); let x=a,i=0; while(x && i++<cap){ seen.add(x); x=x.parent; }
      let y=b,j=0; while(y && j++<cap){ if(seen.has(y)) return y; y=y.parent; }
      return null;
    }

    function collectBattleButtons(root){
      const stack=[root], hits=[];
      while(stack.length){
        const n=stack.pop(); if(!n) continue;
        if (isSprite(n)) {
          const id = texId(n);
          if (YES_TEX.has(id) || NO_TEX.has(id)) hits.push({node:n, id});
        }
        if (n.children?.length) for (const c of n.children) stack.push(c);
      }
      const yes = hits.find(h => YES_TEX.has(h.id) && visibleChain(h.node));
      const no  = hits.find(h => NO_TEX.has(h.id)  && visibleChain(h.node));
      if (yes && no) {
        const parent = commonAncestor(yes.node, no.node) || root;
        return { yes, no, parent };
      }
      return null;
    }

    let lastFire = 0;
    function postYasen(ctx){
      const now = Date.now();
      if (now - lastFire < 1000) return; // 去抖
      lastFire = now;
      try {
        const payload = {
          type: 'YASEN_UI',
          ts: now,
          yesId: texId(ctx.yes.node),
          noId:  texId(ctx.no.node),
          containerName: ctx.parent?.name || ctx.parent?.constructor?.name || '',
        };
        // 通过 JSProxy 上报端侧
        if (window.hmos && typeof window.hmos.post === 'function') {
          window.hmos.post(JSON.stringify(payload));
        } else {
          // 派发一个 DOM 事件，方便调试
          window.dispatchEvent(new CustomEvent('kca:yasen_ui', { detail: payload }));
        }
      } catch(e) {
        console && console.warn && console.warn('[YASEN] post failed:', e);
      }
    }

    function tryDetect(node){
      const r = collectBattleButtons(node);
      if (r) postYasen(r);
    }

    function install(){
      const C = window.PIXI?.Container?.prototype;
      if (!C || C.__kca_yasen_installed__) return;

      const _add = C.addChild;
      C.addChild = function(...args){
        const ret = _add.apply(this, args);
        for (const n of args) setTimeout(() => { tryDetect(n); tryDetect(climbRoot(n)); }, 0);
        return ret;
      };
      const _addAt = C.addChildAt;
      C.addChildAt = function(n,i){
        const ret = _addAt.call(this, n, i);
        setTimeout(() => { tryDetect(n); tryDetect(climbRoot(n)); }, 0);
        return ret;
      };

      // RAF 兜底：每帧检查一次根节点
      (function loop(){
        try {
          const root = window.__KCA_YASEN_MODAL__ || window.__KCA_LAST_ROOT__ || window.app?.stage;
          if (root) tryDetect(root);
        } catch {}
        requestAnimationFrame(loop);
      })();

      C.__kca_yasen_installed__ = true;
      console.log('[YASEN] detector installed (battle_main_9 / battle_main_49).');
    }

    (function boot(){
      if (!window.PIXI?.Container) return setTimeout(boot, 50);
      install();
    })();
  })();`;
}