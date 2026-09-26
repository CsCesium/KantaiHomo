// node scripts/test-attack-plane-counts.cjs [path/to/typescript]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets/domain/models');
const cache = new Map();
function load(relative, base = root) {
  const file = path.resolve(base, relative + '.ts');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', code)(spec => load(spec, path.dirname(file)), module, module.exports);
  return module.exports;
}
const { normalizeBattleSegment } = load('normalizer/battle');
const { mergeBattleSegments } = load('struct/battle');
const stage = (f, fl, e, el) => ({api_f_count:f,api_f_lostcount:fl,api_e_count:e,api_e_lostcount:el});
const normalize = (extra = {}) => normalizeBattleSegment('api_req_sortie/battle', {
  api_f_nowhps:[30],api_f_maxhps:[30],api_e_nowhps:[40],api_e_maxhps:[40],...extra,
}, {now:1});

test('counts attacking aircraft only, without subtracting stage 1 losses twice', () => {
  const {meta} = normalize({api_kouku:{api_stage1:stage(120,20,100,10),api_stage2:stage(60,15,50,40)}});
  assert.equal(`${meta.friendPlaneNow}/${meta.friendPlaneMax}`, '45/60');
  assert.equal(`${meta.enemyPlaneNow}/${meta.enemyPlaneMax}`, '10/50');
  assert.equal(meta.aerialPhases[0].stage1.friendCount,120,'full stage data remains available in details');
});
test('two waves use the last wave survivors and first wave attacking aircraft count', () => {
  const {meta} = normalize({api_kouku:{api_stage2:stage(60,15,50,20)},
    api_kouku2:{api_stage2:stage(40,12,25,25)}});
  assert.equal(`${meta.friendPlaneNow}/${meta.friendPlaneMax}`, '28/60');
  assert.equal(`${meta.enemyPlaneNow}/${meta.enemyPlaneMax}`, '0/50');
  assert.equal(meta.aerialPhases.length,2);
});
test('zero attacking aircraft differs from unavailable stage 2 data', () => {
  const {meta} = normalize({api_kouku:{api_stage1:stage(50,5,0,0),api_stage2:stage(0,0,0,0)}});
  assert.equal(meta.friendPlaneNow,0);
  assert.equal(meta.friendPlaneMax,0);
  for (const extra of [{},{api_kouku:{api_stage1:stage(50,5,20,1),api_stage2:null}}]) {
    const missing = normalize(extra).meta;
    assert.equal(missing.friendPlaneNow,undefined);
    assert.equal(missing.friendPlaneMax,undefined);
    assert.equal(missing.enemyPlaneNow,undefined);
  }
});
test('a lone second wave is supported and over-reported losses do not become negative', () => {
  const {meta} = normalize({api_kouku2:{api_stage2:stage(10,12,20,5)}});
  assert.equal(`${meta.friendPlaneNow}/${meta.friendPlaneMax}`, '0/10');
  assert.equal(`${meta.enemyPlaneNow}/${meta.enemyPlaneMax}`, '15/20');
});
test('night follow-up retains day battle attacking aircraft counts', () => {
  const day = normalize({api_kouku:{api_stage2:stage(30,12,50,20)}});
  const night = normalizeBattleSegment('api_req_battle_midnight/battle', {
    api_f_nowhps:[30],api_f_maxhps:[30],api_e_nowhps:[40],api_e_maxhps:[40],
    api_hougeki:{api_damage:[],api_at_list:[],api_df_list:[]},
  });
  const {meta} = mergeBattleSegments(day,night);
  assert.equal(`${meta.friendPlaneNow}/${meta.friendPlaneMax}`, '18/30');
  assert.equal(`${meta.enemyPlaneNow}/${meta.enemyPlaneMax}`, '30/50');
});
test('land base attack waves do not replace main fleet attacking aircraft counts', () => {
  const {meta} = normalize({api_air_base_attack:[{api_stage2:stage(18,1,30,20)}],
    api_kouku:{api_stage2:stage(50,7,10,4)}});
  assert.equal(`${meta.friendPlaneNow}/${meta.friendPlaneMax}`, '43/50');
  assert.equal(`${meta.enemyPlaneNow}/${meta.enemyPlaneMax}`, '6/10');
  assert.equal(meta.lbasWaves[0].stage2.friendCount,18);
});
