/**
 * AdvanceDetect — 检测战斗后"进击/撤退"及联合舰队"退避/退避せず"选择界面
 *
 * Hook PIXI addChild 并配合 RAF 轮询，
 * 检测到决策按钮对同时可见时，向 ArkTS 端上报 SORTIE_ADVANCE_UI 消息。
 *
 * 纹理 ID（map_decision_* 系列，KC HTML5 PIXI stage 实际值）：
 *   map_decision_1  / map_decision_8  → 進撃 / 進撃_glow
 *   map_decision_13 / map_decision_14 → 撤退 / 撤退_glow
 *   map_decision_11 / map_decision_12 → 退避 / 退避_glow        (联合舰队护卫队退避)
 *   map_decision_9  / map_decision_10 → 退避せず / 退避せず_glow
 */
export function advanceDetectorJS(): string {
  return `
  (() => {
    // 進撃/撤退（普通出击每节点决策）
    const ADVANCE_TEX  = new Set(['map_decision_1',  'map_decision_8']);
    const RETREAT_TEX  = new Set(['map_decision_13', 'map_decision_14']);
    // 退避/退避せず（联合舰队护卫队专用）
    const EVADE_TEX    = new Set(['map_decision_11', 'map_decision_12']);
    const NO_EVADE_TEX = new Set(['map_decision_9',  'map_decision_10']);

    // 按场景分组：[正向按钮集合, 反向按钮集合]
    const SCENES = [
      [ADVANCE_TEX,  RETREAT_TEX],   // 進撃 vs 撤退
      [EVADE_TEX,    NO_EVADE_TEX],  // 退避 vs 退避せず
    ];

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

    function collectButtons(root) {
      const stack = [root];
      const byTex = new Map(); // texId -> { node, id }
      while (stack.length) {
        const n = stack.pop(); if (!n) continue;
        if (isSprite(n)) {
          const id = texId(n);
          for (const [posSet, negSet] of SCENES) {
            if ((posSet.has(id) || negSet.has(id)) && visibleChain(n)) {
              if (!byTex.has(id)) byTex.set(id, { node: n, id });
            }
          }
        }
        if (n.children?.length) for (const c of n.children) stack.push(c);
      }
      for (const [posSet, negSet] of SCENES) {
        const pos = [...byTex.values()].find(h => posSet.has(h.id));
        const neg = [...byTex.values()].find(h => negSet.has(h.id));
        if (pos && neg) {
          return { adv: pos, ret: neg, parent: commonAncestor(pos.node, neg.node) || root };
        }
      }
      return null;
    }

    let lastFire = 0;
    function postAdvance(ctx) {
      const now = Date.now();
      if (now - lastFire < 2000) return;
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
      const r = collectButtons(node);
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

      (function loop() {
        try {
          const root = window.app?.stage;
          if (root) tryDetect(root);
        } catch {}
        requestAnimationFrame(loop);
      })();

      C.__kca_advance_installed__ = true;
      console.log('[ADVANCE] detector installed (map_decision_*).');
    }

    (function boot() {
      if (!window.PIXI?.Container) return setTimeout(boot, 50);
      install();
    })();
  })();`;
}