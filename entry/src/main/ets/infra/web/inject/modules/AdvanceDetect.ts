/**
 * AdvanceDetect — 检测战斗结算后的"进击/撤退"选择界面
 *
 * 与 YasenDetect 原理相同：Hook PIXI addChild 并配合 RAF 轮询，
 * 检测到进击/撤退两个可见按钮同时出现时，向 ArkTS 端上报 SORTIE_ADVANCE_UI 消息。
 *
 * ⚠ 纹理 ID 说明：
 *   ADVANCE_TEX / RETREAT_TEX 来自对 KC HTML5 PIXI stage 的实际抓包分析。
 *   若检测失效，请在浏览器控制台打印 PIXI stage 节点后更新下方 Set。
 */
export function advanceDetectorJS(): string {
  return `
  (() => {
    // ---- 进击/撤退 按钮纹理 ID（实际游戏中的值，如失效请更新） ----
    const ADVANCE_TEX = new Set(['battle_main_5', 'battle_main_66']);  // 進撃する
    const RETREAT_TEX = new Set(['battle_main_7', 'battle_main_68']);  // 撤退する

    const isSprite = n => window.PIXI && n instanceof PIXI.Sprite;
    function texId(n) {
      try {
        const t = n.texture; if (!t) return '';
        if (t.textureCacheIds?.length) return t.textureCacheIds[0] || '';
        return t.baseTexture?.resource?.url || '';
      } catch { return ''; }
    }
    function visibleChain(n) {
      let cur = n, hop = 0;
      while (cur && hop++ < 12) { if (cur.visible === false) return false; cur = cur.parent; }
      return true;
    }
    function commonAncestor(a, b, cap = 8) {
      if (!a || !b) return null;
      const seen = new Set(); let x = a, i = 0;
      while (x && i++ < cap) { seen.add(x); x = x.parent; }
      let y = b, j = 0;
      while (y && j++ < cap) { if (seen.has(y)) return y; y = y.parent; }
      return null;
    }

    function collectAdvanceButtons(root) {
      const stack = [root], hits = [];
      while (stack.length) {
        const n = stack.pop(); if (!n) continue;
        if (isSprite(n)) {
          const id = texId(n);
          if (ADVANCE_TEX.has(id) || RETREAT_TEX.has(id)) hits.push({ node: n, id });
        }
        if (n.children?.length) for (const c of n.children) stack.push(c);
      }
      const adv = hits.find(h => ADVANCE_TEX.has(h.id) && visibleChain(h.node));
      const ret = hits.find(h => RETREAT_TEX.has(h.id) && visibleChain(h.node));
      if (adv && ret) {
        const parent = commonAncestor(adv.node, ret.node) || root;
        return { adv, ret, parent };
      }
      return null;
    }

    let lastFire = 0;
    function postAdvance(ctx) {
      const now = Date.now();
      if (now - lastFire < 2000) return; // 去抖（结算->进撃UI 一般 >1 s）
      lastFire = now;
      try {
        const payload = {
          type: 'SORTIE_ADVANCE_UI',
          ts: now,
          advId: texId(ctx.adv.node),
          retId: texId(ctx.ret.node),
        };
        if (window.hmos && typeof window.hmos.post === 'function') {
          window.hmos.post(JSON.stringify(payload));
        } else {
          window.dispatchEvent(new CustomEvent('kca:advance_ui', { detail: payload }));
        }
      } catch (e) {
        console && console.warn && console.warn('[ADVANCE] post failed:', e);
      }
    }

    function tryDetect(node) {
      const r = collectAdvanceButtons(node);
      if (r) postAdvance(r);
    }

    function climbRoot(n) { let cur = n; for (let i = 0; i < 1000 && cur?.parent; i++) cur = cur.parent; return cur || n; }

    function install() {
      const C = window.PIXI?.Container?.prototype;
      if (!C || C.__kca_advance_installed__) return;

      const _add = C.addChild;
      C.addChild = function(...args) {
        const ret = _add.apply(this, args);
        for (const n of args) setTimeout(() => { tryDetect(n); tryDetect(climbRoot(n)); }, 0);
        return ret;
      };
      const _addAt = C.addChildAt;
      C.addChildAt = function(n, i) {
        const ret = _addAt.call(this, n, i);
        setTimeout(() => { tryDetect(n); tryDetect(climbRoot(n)); }, 0);
        return ret;
      };

      // RAF 兜底扫描
      (function loop() {
        try {
          const root = window.app?.stage;
          if (root) tryDetect(root);
        } catch {}
        requestAnimationFrame(loop);
      })();

      C.__kca_advance_installed__ = true;
      console.log('[ADVANCE] detector installed.');
    }

    (function boot() {
      if (!window.PIXI?.Container) return setTimeout(boot, 50);
      install();
    })();
  })();`;
}
