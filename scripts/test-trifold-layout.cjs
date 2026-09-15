// Run layout decisions and WebHost's real state transitions without an ArkUI device.
// Usage: node scripts/test-trifold-layout.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');
const display = { FoldStatus: { FOLD_STATUS_EXPANDED_WITH_SECOND_EXPANDED: 11 } };
const cache = new Map();

function compile(source, filename, globals = {}, requireModule) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: requireModule, ...globals }, { filename });
  return exports;
}

function load(relativePath) {
  const filename = path.resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename);
  const result = compile(fs.readFileSync(filename, 'utf8'), filename, {}, id => {
    if (id === '@ohos.display') return { default: display };
    const base = path.resolve(path.dirname(filename), id);
    return load(fs.existsSync(`${base}.ets`) ? `${base}.ets` : `${base}.ts`);
  });
  cache.set(filename, result);
  return result;
}

const responsive = load('infra/web/layout/responsive.ets');
const { WindowScene, HostMode } = responsive;
const { resolveTriFoldLayout } = load('infra/web/layout/triFold.ets');
const { PanelMode } = load('features/panel/type.ts');

// Extract actual non-UI methods using the TypeScript AST; do not duplicate their logic.
const hostSource = fs.readFileSync(path.join(root, 'infra/web/WebHost.ets'), 'utf8');
const logicSource = hostSource.slice(0, hostSource.indexOf('\n  build()'))
  .replace('export default struct WebHost', 'export default class WebHost') + '\n}';
const parsed = ts.createSourceFile('WebHost.ts', logicSource, ts.ScriptTarget.Latest, true);
const hostClass = parsed.statements.find(ts.isClassDeclaration);
const methods = hostClass.members.filter(ts.isMethodDeclaration).map(node => node.getText(parsed)).join('\n');
const Host = compile(`export default class Host { ${methods} }`, 'WebHostLogic.ts', {
  ...responsive,
  ...load('infra/web/layout/gameSize.ets'),
  ...load('features/panel/panelLayoutManager.ets'),
  resolveTriFoldLayout, PanelMode,
  NARROW_SHORT_SIDE_VP: 420,
  FLOATING_TOOL_SURFACE_MIN_WIDTH_VP: 700,
  setLauncherSwipeBlocked: () => {},
}).default;

function harness() {
  const h = new Host();
  const calls = [];
  Object.assign(h, {
    viewportWidthVp: 1200, viewportHeightVp: 800, foldStatus: 11,
    scene: WindowScene.FULLSCREEN, triFoldActive: false, triFoldInfoOnLeft: false,
    mainViewportWidthVp: 0, infoViewportWidthVp: 0, lrLayoutForced: false,
    lastMode: null, compactGameSizePercent: 100, expandedGameSizePercent: 100,
    landscapeOrientationPending: false, restoreLandscapeAfterManualLayout: false,
    battlePreviewAvailable: true, battlePreviewVisible: true,
    autoBattlePreviewFloatOverlay: true, overlayForced: false,
    battlePreviewAutoOverlayActive: false, battlePreviewAutoOverlaySuppressed: false,
    host: {
      applyOrientationByMode: () => { calls.push('orientation'); },
      onPageEnd: () => { calls.push('pageEnd'); },
      reapplyFit: () => { calls.push('fit'); },
    },
  });
  h.resize = (w, height, status = h.foldStatus, scene = h.scene) => {
    Object.assign(h, { viewportWidthVp: w, viewportHeightVp: height, foldStatus: status, scene });
    h.recalcLayout(w, height);
    h.updateBattlePreviewAutoOverlay();
  };
  h.calls = calls;
  return h;
}

test('single-face, dual-face, hover, normal foldable and unknown states keep the full viewport', () => {
  for (const status of [0, 1, 2, 3, 12, 13, 21, 22, 23]) {
    const result = resolveTriFoldLayout(1200, 800, WindowScene.FULLSCREEN, status);
    assert.equal(result.active, false, `fold status ${status}`);
    assert.equal(result.mainWidthVp, 1200);
    assert.equal(result.infoWidthVp, 0);
  }
});

test('portrait, square, zero-sized and multi-window viewports do not reserve a third face', () => {
  for (const [w, h, scene] of [
    [800, 1200, WindowScene.FULLSCREEN], [800, 800, WindowScene.FULLSCREEN],
    [0, 0, WindowScene.FULLSCREEN], [1200, 0, WindowScene.FULLSCREEN],
    [1200, 800, WindowScene.SPLIT], [1200, 800, WindowScene.FLOATING],
  ]) {
    assert.equal(resolveTriFoldLayout(w, h, scene, 11).active, false);
  }
});

test('AB uses the dual-face game size and keeps a bottom dashboard beside C', () => {
  const h = harness();
  h.resize(1200, 800);
  assert.equal(h.mainViewportWidthVp, 800);
  assert.equal(h.infoViewportWidthVp, 400);
  assert.equal(h.mode, HostMode.EXPANDED);
  assert.equal(h.gameWidthVp, 800);
  assert.equal(h.gameHeightVp, 480);
  assert.equal(h.panelConfig.mode, PanelMode.BottomPanel);
  assert.equal(h.panelConfig.bottomPanelHeight, 320);
  assert.equal(h.showBattlePreviewInMainPane(), false);
  h.expandedGameSizePercent = 80;
  h.resize(1200, 800);
  assert.equal(h.gameWidthVp, 640);
  assert.equal(h.gameHeightVp, 384);
});

test('swapping changes only pane positions and works even without battle data', () => {
  const h = harness();
  h.resize(1201, 800);
  h.battlePreviewAvailable = false;
  h.calls.length = 0;
  const gameSize = [h.gameWidthVp, h.gameHeightVp];
  assert.equal(h.getMainViewportLeft(), 0);
  assert.equal(h.getInfoViewportLeft(), 801);
  h.swapTriFoldPanes();
  assert.equal(h.getMainViewportLeft(), 400);
  assert.equal(h.getInfoViewportLeft(), 0);
  assert.equal(h.mainViewportWidthVp + h.infoViewportWidthVp, 1201);
  assert.deepEqual([h.gameWidthVp, h.gameHeightVp], gameSize);
  assert.deepEqual(h.calls, [], 'no reload, fit injection or rotation during a swap');
  h.swapTriFoldPanes();
  assert.equal(h.getMainViewportLeft(), 0);
  assert.equal(h.getInfoViewportLeft(), 801);
});

test('folding or rotating restores preview toggling and unfolding retains pane preference', () => {
  const h = harness();
  h.resize(1200, 800);
  h.swapTriFoldPanes();
  h.toggleBattlePreview();
  assert.equal(h.battlePreviewVisible, true, 'dedicated preview cannot be toggled');
  h.resize(800, 800, 1);
  assert.equal(h.triFoldActive, false);
  assert.equal(h.getMainViewportLeft(), 0);
  assert.equal(h.showBattlePreviewInMainPane(), true);
  h.toggleBattlePreview();
  assert.equal(h.showBattlePreviewInMainPane(), false);
  h.resize(1200, 800, 11);
  assert.equal(h.triFoldActive, true);
  assert.equal(h.getMainViewportLeft(), 400);
  h.resize(800, 1200);
  assert.equal(h.triFoldActive, false);
  assert.equal(h.infoViewportWidthVp, 0);
  assert.equal(h.mainViewportWidthVp, 800);
});

test('entering three-face mode closes an automatic battle overlay and updates fit at the same host mode', () => {
  const h = harness();
  h.resize(800, 360, 2);
  assert.equal(h.battlePreviewAutoOverlayActive, true);
  h.calls.length = 0;
  h.resize(1200, 360, 11);
  assert.equal(h.mode, HostMode.COMPACT);
  assert.equal(h.battlePreviewAutoOverlayActive, false);
  assert.equal(h.overlayForced, false);
  assert.ok(h.calls.includes('fit'));
  assert.ok(!h.calls.includes('pageEnd'));
});

test('multi-window transitions restore full window width on a fully unfolded device', () => {
  const h = harness();
  h.resize(1200, 800);
  for (const scene of [WindowScene.SPLIT, WindowScene.FLOATING]) {
    h.resize(900, 600, 11, scene);
    assert.equal(h.triFoldActive, false);
    assert.equal(h.mainViewportWidthVp, 900);
    assert.equal(h.infoViewportWidthVp, 0);
  }
  h.resize(1200, 800, 11, WindowScene.FULLSCREEN);
  assert.equal(h.triFoldActive, true);
});

test('portrait keeps the original game, dashboard, button and preview behavior at every fold state', () => {
  for (const [width, height] of [[360, 800], [720, 1000], [800, 1200]]) {
    const baseline = harness();
    baseline.expandedGameSizePercent = 80;
    baseline.resize(width, height, 1);
    for (const status of [0, 1, 2, 3, 11, 12, 13, 21, 22, 23]) {
      const h = harness();
      h.expandedGameSizePercent = 80;
      h.resize(1200, 800, 11);
      h.swapTriFoldPanes();
      h.resize(width, height, status);
      for (const property of [
        'mode', 'fit', 'fitLocked', 'showSideButtons', 'showBottomTools',
        'gameWidthVp', 'gameHeightVp', 'gameLeftMarginVp', 'sidebarWidthVp',
      ]) {
        assert.equal(h[property], baseline[property], `${width}x${height}, fold ${status}, ${property}`);
      }
      assert.deepEqual(h.panelConfig, baseline.panelConfig);
      assert.equal(h.triFoldActive, false);
      assert.equal(h.canToggleLrLayout(), baseline.canToggleLrLayout());
      assert.equal(h.getMainViewportLeft(), 0);
      assert.equal(h.showBattlePreviewInMainPane(), true);
      h.toggleBattlePreview();
      assert.equal(h.showBattlePreviewInMainPane(), false);
      h.swapTriFoldPanes();
      assert.equal(h.getMainViewportLeft(), 0);
    }
  }
});
