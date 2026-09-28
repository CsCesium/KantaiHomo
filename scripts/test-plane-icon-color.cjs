// node scripts/test-plane-icon-color.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');

function load(relative, name) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: name, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: spec => { throw new Error(`unexpected dependency: ${spec}`); } });
  return exports;
}

const { silhouetteTintMatrix } = load('features/panel/planeIconColor.ts', 'planeIconColor.ts');

// Read the palette out of the source text: panelConfig.ts pulls in equipment data we do not need here.
function panelColor(name) {
  const source = fs.readFileSync(path.join(root, 'features/panel/panelConfig.ts'), 'utf8');
  const at = source.indexOf(`${name}:`);
  assert.ok(at >= 0, `PanelColors.${name} not found`);
  const open = source.indexOf("'", at);
  const close = source.indexOf("'", open + 1);
  const hex = source.slice(open + 1, close);
  assert.equal(hex.length, 7, `PanelColors.${name} is not a #rrggbb literal: ${hex}`);
  return hex;
}

const FRIENDLY = panelColor('hpOk');   // '#43a047' green
const ENEMY = panelColor('hpCrit');    // '#e53935' red
const translate = m => [m[4], m[9], m[14]];

test('the translate column is normalized to 0..1, so the silhouette is not clamped to white', () => {
  for (const hex of [FRIENDLY, ENEMY, '#000000', '#ffffff']) {
    const matrix = Array.from(silhouetteTintMatrix(hex));
    assert.equal(matrix.length, 20, '4x5 color matrix');
    for (const value of matrix) {
      assert.ok(value >= 0 && value <= 1, `${hex}: ${value} must stay within 0..1`);
    }
  }
});

test('friendly renders green and enemy renders red, matching the count text colors', () => {
  assert.deepEqual(translate(silhouetteTintMatrix(FRIENDLY)), [0x43 / 255, 0xa0 / 255, 0x47 / 255]);
  assert.deepEqual(translate(silhouetteTintMatrix(ENEMY)), [0xe5 / 255, 0x39 / 255, 0x35 / 255]);

  const friendly = translate(silhouetteTintMatrix(FRIENDLY));
  const enemy = translate(silhouetteTintMatrix(ENEMY));
  assert.notDeepEqual(friendly, enemy, 'the two sides must be distinguishable');
  assert.ok(friendly[1] > friendly[0] && friendly[1] > friendly[2], 'friendly is green-dominant');
  assert.ok(enemy[0] > enemy[1] && enemy[0] > enemy[2], 'enemy is red-dominant');
});

test('RGB multipliers are cleared and alpha passes through, preserving transparency', () => {
  const matrix = Array.from(silhouetteTintMatrix(FRIENDLY));
  for (const row of [0, 1, 2]) {
    assert.deepEqual(matrix.slice(row * 5, row * 5 + 4), [0, 0, 0, 0],
      'output RGB comes only from the translate column');
  }
  assert.deepEqual(matrix.slice(15), [0, 0, 0, 1, 0], 'alpha row is the identity passthrough');
});

test('black and white endpoints map to the matrix extremes', () => {
  assert.deepEqual(translate(silhouetteTintMatrix('#000000')), [0, 0, 0]);
  assert.deepEqual(translate(silhouetteTintMatrix('#ffffff')), [1, 1, 1]);
});

test('the panel still renders the icon through the shared tint matrix', () => {
  const panel = fs.readFileSync(
    path.join(root, 'app/pages/components/panel/battle/BattlePreviewPanel.ets'), 'utf8');
  assert.match(panel, /silhouetteTintMatrix\(friendly \? PanelColors\.hpOk : PanelColors\.hpCrit\)/);
});
