// node scripts/test-ship-capabilities.cjs [path/to/typescript]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');
const cache = new Map();
function load(name, base = root) {
  const resolved = path.resolve(base, name);
  const file = fs.existsSync(resolved + '.ts') ? resolved + '.ts' : path.join(resolved, 'index.ts');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require','module','exports',code)(spec => load(spec,path.dirname(file)),module,module.exports);
  return module.exports;
}
const { detectAacis, matchesShipRestriction } = load('features/calc/aaci');
const { buildShipCapabilityTags } = load('features/panel/shipCapabilityTags');
const { SlotItemEquipType: T, SlotItemIconId: I } = load('domain/models');
const eq = (id,type,aa=0,asw=0,icon=0,name='') => ({id,name,type:{equipType:type,iconId:icon},stats:{aa,asw,los:0}});
const gun = (id=122,aa=10) => eq(id,T.SmallCaliberMainGun,aa,0,I.HighAngleGun);
const radar = (id=27,aa=4) => eq(id,T.SmallRadar,aa);
const mg = (aa=9) => eq(131,T.AAGun,aa);
const types = (id,equips,ctype=0,stype=2) => detectAacis(id,stype,ctype,equips).map(a => a.typeId);
function asw(id,stype,stat,equips=[],onslot=0) {
  return buildShipCapabilityTags({shipMasterId:id,stype,ctype:0,aswCur:stat,
    slots:equips.map((_,i)=>i+1),onslot:equips.map(()=>onslot),exSlot:0,
    slotItemIndex:new Map(equips.map((e,i)=>[i+1,e.id])),
    slotItemEquipTypes:new Map(equips.map(e=>[e.id,e.type.equipType])),
    slotItemIconTypes:new Map(equips.map(e=>[e.id,e.type.iconId])),
    slotItemLos:new Map(),slotItemAa:new Map(equips.map(e=>[e.id,e.stats.aa])),
    slotItemAsw:new Map(equips.map(e=>[e.id,e.stats.asw])),
    slotItemNames:new Map(equips.map(e=>[e.id,e.name])),
  }).includes('先制対潜');
}
const sonar = eq(47,T.Sonar,0,10);

test('new remodels and new class members retain their class-specific AACI', () => {
  for (const id of [357,533,538,963,968,1041,1046]) assert.ok(types(id,[gun(),gun(),radar()]).includes(1),id);
  for (const id of [699,700]) assert.ok(!types(id,[gun(),gun(),radar()]).includes(1),id);
  assert.ok(types(1400,[gun(),gun(),radar()],54).includes(1),'master class covers future class members');
  for (const id of [941,726,942,737,689,692]) assert.ok(types(id,[gun(313,7),gun(313,7)]).includes(37),id);
  assert.ok(!types(597,[gun(313,7),gun(313,7)]).includes(37),'Atlanta is not a Fletcher');
  assert.ok(!types(562,[gun(284,6),gun(284,6)]).includes(37),'unmodified Mk.30 cannot replace Mk.30 Kai');
});

test('Hiryuu Kai San and Kitakami Kai San share only their verified special types', () => {
  const equips = [gun(),mg(),radar()];
  for (const id of [1031,1071]) assert.ok(types(id,equips).includes(10),id);
  assert.ok(types(1031,equips).includes(11));
  assert.ok(!types(1071,equips).includes(11));
  for (const id of [1031,1071]) {
    assert.ok(types(id,[gun(275,9),radar()]).includes(53));
    assert.ok(!types(id,[gun(130,8),radar()]).includes(53));
    assert.ok(!types(id,[gun(275,9),radar(27,3)]).includes(53));
  }
  assert.ok(types(1071,[gun(),mg(2),radar()]).includes(14));
  assert.ok(types(1071,[gun(),radar()]).includes(21));
  assert.ok(types(1071,[gun(),gun(),radar()]).includes(49));
  const rocket = eq(274,T.AAGun,8);
  for (const id of [321,1031]) assert.ok(types(id,[gun(275,9),rocket,radar()]).includes(27));
  assert.ok(!types(1071,[gun(275,9),rocket,radar()]).includes(27));
});

test('Suzunami remodels, Fubuki/Shigure and Akizuki expanded types respect individual restrictions', () => {
  for (const id of [1034,745]) assert.ok(types(id,[gun(),gun(),radar()]).includes(49));
  for (const id of [141,1035,961]) assert.ok(types(id,[gun(),mg(2)]).includes(15));
  for (const id of [470,622,1035,961]) assert.ok(types(id,[gun(),mg(2),radar()]).includes(16));
  assert.ok(!types(1040,[gun(),mg(2),radar()]).includes(16));
  const director = eq(121,T.AADirector,3);
  const upgraded = [gun(533,13),gun(533,13),radar(),director];
  assert.ok(types(963,upgraded).includes(48));
  assert.ok(types(963,upgraded).includes(50));
  assert.ok(!types(421,upgraded).includes(48),'type 48 requires a remodel');
  assert.ok(types(1046,[gun(553,8),gun(553,8),director]).includes(52));
});

test('Reno and Atlanta use correct guns and require actual GFCS radar for type 40', () => {
  const plain = gun(362,11), gfcs = gun(363,14);
  for (const id of [597,696,991,747]) {
    assert.ok(types(id,[gfcs,gfcs]).includes(38));
    assert.ok(types(id,[gfcs,plain]).includes(39));
    assert.ok(types(id,[plain,plain]).includes(41));
    assert.ok(types(id,[plain,plain,radar(307,7)]).includes(40));
    assert.ok(!types(id,[plain,plain,radar()]).includes(40));
  }
  assert.ok(!types(622,[gfcs,gfcs]).includes(38),'Yuubari is not Atlanta');
  assert.ok(types(911,[gun(464,9),radar(142,8)]).includes(42));
  assert.ok(!types(911,[gfcs,radar(142,8)]).includes(42));
});

test('detected modern AACIs agree with their ship restriction metadata', () => {
  const equips = [gun(533,13),gun(533,13),gun(275,9),gun(308,11),gun(313,7),
    gun(362,11),gun(363,14),radar(307,7),mg(),eq(274,T.AAGun,8),eq(121,T.AADirector,3)];
  for (const id of [963,1046,1031,1071,745,1035,1040,961,622,747,737]) {
    for (const a of detectAacis(id,2,0,equips)) assert.ok(matchesShipRestriction(a.info.shipRestriction,id,2,0),`${id}: ${a.typeId}`);
  }
});

test('automatic opening ASW distinguishes exact remodels, including new destroyers', () => {
  for (const id of [141,478,624,394,893,906,681,920,562,689,596,692,628,629,726,737,1062,1067,1040]) {
    assert.equal(asw(id,2,50),true,id);
  }
  for (const id of [901,941,942,1035]) assert.equal(asw(id,2,99),false,id);
  assert.equal(asw(1035,2,100,[sonar]),true);
  assert.equal(asw(1071,4,99,[sonar]),false);
  assert.equal(asw(1071,4,100,[sonar]),true);
});

test('light carrier opening ASW handles small sonar, aircraft loss and raw aircraft ASW threshold', () => {
  const plane = eq(83,T.CarrierTorpedoBomber,0,7);
  assert.equal(asw(1036,7,50,[sonar,plane]),true,'Independence Flight II small sonar');
  assert.equal(asw(534,7,50,[sonar,plane]),true,'Shinyou can equip small sonar');
  assert.equal(asw(560,7,65,[plane]),true,'empty aircraft slot remains eligible');
  assert.equal(asw(560,7,64,[plane]),false);
  assert.equal(asw(560,7,99,[eq(83,T.CarrierTorpedoBomber,0,6)]),false);
  for (const id of [380,529,381,536,382,889,646]) assert.equal(asw(id,7,0,[eq(82,T.CarrierTorpedoBomber,0,1)]),true);
  for (const id of [508,509]) assert.equal(asw(id,7,120,[sonar,plane]),false);
});

test('special aviation battleships use remodel and aircraft IDs rather than translated names', () => {
  for (const id of [411,412,748,749]) assert.equal(asw(id,10,100,[sonar,eq(226,T.DepthCharge,0,8)]),true);
  assert.equal(asw(411,10,99,[sonar,eq(226,T.DepthCharge,0,8)]),false);
  assert.equal(asw(554,10,0,[eq(324,T.Autogyro,0,10),eq(325,T.Autogyro,0,11)]),true);
  assert.equal(asw(554,10,0,[eq(326,T.Autogyro,0,12)]),true);
  assert.equal(asw(554,10,100,[sonar,eq(324,T.Autogyro,0,10)]),false);
  for (const id of [998,999,738,739]) assert.equal(asw(id,1,100,[sonar]),false);
});
