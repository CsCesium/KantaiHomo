// node scripts/test-modernization-toast.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');

function transpile(relative, name, sandbox) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: name, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, Object.assign({ exports }, sandbox));
  return exports;
}

/**
 * The real alert bus and executor run against in-memory fakes, so the toast text under test is
 * the text the app produces. Only the platform toast API and the game state are substituted.
 */
function harness(overrides) {
  const state = Object.assign({
    ships: new Map(), caps: new Map(), masterNames: new Map(), toasts: [], now: 1_700_000_000_000,
  }, overrides);

  const alertType = transpile('features/alerts/type.ts', 'type.ts', {
    require: spec => { throw new Error(`unexpected type dependency: ${spec}`); },
  });
  const bus = transpile('features/alerts/bus.ts', 'bus.ts', {
    console: { info() {}, warn() {}, debug() {} },
    require: spec => {
      assert.equal(spec, './type', `unexpected bus dependency: ${spec}`);
      return alertType;
    },
  });

  const stateModule = {
    getShip: uid => state.ships.get(uid),
    getShipModernizationCaps: masterId => state.caps.get(masterId),
    getShipMasterName: masterId => state.masterNames.get(masterId),
  };
  const utils = {
    // Mirrors features/utils/common.ts: malformed payloads yield null rather than throwing.
    parseSvdata: text => {
      if (!text) return null;
      try {
        return JSON.parse(text.startsWith('svdata=') ? text.slice(7) : text);
      } catch {
        return null;
      }
    },
    parseFormBody: body => ({
      getInt: (key, fallback) => {
        for (const part of String(body || '').split('&')) {
          const [name, value] = part.split('=');
          if (name === key) {
            const parsed = parseInt(value, 10);
            return Number.isNaN(parsed) ? fallback : parsed;
          }
        }
        return fallback;
      },
    }),
  };

  const modernization = transpile('features/alerts/module/modernization.ts', 'modernization.ts', {
    Date: class extends Date { static now() { return state.now; } },
    require: spec => {
      if (spec === '../../state') return stateModule;
      if (spec === '../../utils/common') return utils;
      if (spec === '../bus') return bus;
      if (spec === '../type') return alertType;
      throw new Error(`unexpected modernization dependency: ${spec}`);
    },
  });

  // The executor is .ets; substitute only the platform bindings it reaches for.
  const executor = transpile('features/alerts/executor.ets', 'executor.ts', {
    console: { info() {}, warn() {}, debug() {} },
    require: spec => {
      if (spec === '@ohos.promptAction') {
        return { default: { showToast: options => state.toasts.push(options) } };
      }
      if (spec === '.') return bus;
      if (spec === './type') return alertType;
      return platformStub(spec);
    },
  });
  executor.initAlertExecutor();
  return { state, bus, modernization, alertType };
}

/** Anything the executor imports for other alert types is irrelevant here. */
function platformStub(spec) {
  return new Proxy({}, {
    get: (_target, key) => {
      if (key === 'default') return platformStub(spec);
      return () => undefined;
    },
  });
}

const MASTER_ID = 501;
const UID = 77;

function ship(overrides) {
  return Object.assign({
    api_id: UID, api_ship_id: MASTER_ID, api_maxhp: 31,
    api_kyouka: [0, 0, 0, 0, 0, 0, 0],
    api_karyoku: [20, 20], api_raisou: [24, 24], api_taiku: [16, 16],
    api_soukou: [14, 14], api_lucky: [10, 10], api_taisen: [30, 60],
  }, overrides);
}

function before(overrides) {
  return Object.assign({
    name: '睦月', hpMax: 31, fireCur: 20, torpCur: 24, aaCur: 16,
    armorCur: 14, luckCur: 10, aswCur: 30,
  }, overrides);
}

const CAPS = { firepower: 5, torpedo: 6, antiAir: 4, armor: 3, luck: 7, taikMax: 33 };

function dump(flag, ships, body) {
  return {
    url: 'http://203.104.209.55/kcsapi/api_req_kaisou/powerup',
    requestBody: body ?? `api_id=${UID}&api_id_items=101,102`,
    responseText: `svdata=${JSON.stringify({ api_result: 1, api_data: { api_powerup_flag: flag, api_ship: ships } })}`,
  };
}

function run(h, options) {
  h.state.ships.set(UID, before(options.before));
  if (options.caps !== null) h.state.caps.set(MASTER_ID, options.caps ?? CAPS);
  h.state.masterNames.set(MASTER_ID, '睦月');
  // The game's PowerUpAPI returns one ship object, not an array.
  h.modernization.publishModernizationAlert(dump(options.flag ?? 1, ship(options.after), options.body));
  return h.state.toasts;
}

test('a single-stat success reports this gain and the remaining room', () => {
  const h = harness();
  const toasts = run(h, {
    after: { api_kyouka: [2, 0, 0, 0, 0, 0, 0], api_karyoku: [22, 22] },
  });
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].message, '🔧 改修成功：火力 +2/+3');
  assert.equal(toasts[0].duration, 3000);
  assert.equal(toasts[0].textColor, undefined);
});

test('a response for a different ship never gets compared against the requested ship', () => {
  const h = harness();
  h.state.ships.set(UID, before());
  const other = ship({ api_id: UID + 1, api_karyoku: [99, 99] });
  h.modernization.publishModernizationAlert(dump(1, other));
  h.modernization.publishModernizationAlert(dump(1, [other]));
  assert.equal(h.state.toasts.length, 0);
});

test('feeding coastal defense ships lists every raised stat, separated by a Chinese enumeration comma', () => {
  const h = harness();
  const toasts = run(h, {
    after: {
      api_kyouka: [1, 0, 0, 0, 1, 0, 3],
      api_karyoku: [21, 21], api_lucky: [11, 11], api_taisen: [33, 60],
    },
  });
  assert.equal(toasts.length, 1);
  // Order follows api_kyouka: firepower, torpedo, antiAir, armor, luck, hp, asw.
  assert.equal(toasts[0].message, '🔧 改修成功：火力 +1/+4、运 +1/+6、对潜 +3/+6');
});

test('a failed modernization reports only the failure', () => {
  const h = harness();
  const toasts = run(h, { flag: 0, after: {} });
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].message, '🔧 近代化改修失败');
  assert.equal(toasts[0].textColor, '#FF9F43');
});

test('a maxed stat reports zero remaining instead of a negative number', () => {
  const h = harness();
  const toasts = run(h, {
    after: { api_kyouka: [5, 0, 0, 0, 0, 0, 0], api_karyoku: [23, 23] },
    before: { fireCur: 20 },
  });
  assert.equal(toasts[0].message, '🔧 改修成功：火力 +3/+0');

  // Over-applied values (data drift) must not produce a negative remaining either.
  const over = harness();
  const overToasts = run(over, {
    after: { api_kyouka: [9, 0, 0, 0, 0, 0, 0], api_karyoku: [24, 24] },
  });
  assert.equal(overToasts[0].message, '🔧 改修成功：火力 +4/+0');
});

test('hp uses the hardcoded limit of 2 and the master hp ceiling', () => {
  const h = harness();
  const toasts = run(h, {
    after: { api_kyouka: [0, 0, 0, 0, 0, 1, 0], api_maxhp: 32 },
  });
  // VHP 2 - applied 1 = 1, master ceiling 33 - 32 = 1 -> the smaller of the two.
  assert.equal(toasts[0].message, '🔧 改修成功：耐久 +1/+1');

  const atCeiling = harness();
  const ceilingToasts = run(atCeiling, {
    after: { api_kyouka: [0, 0, 0, 0, 0, 1, 0], api_maxhp: 33 },
  });
  assert.equal(ceilingToasts[0].message, '🔧 改修成功：耐久 +2/+0');
});

test('asw uses the hardcoded limit of 9 and is unavailable without asw capability', () => {
  const h = harness();
  const toasts = run(h, {
    after: { api_kyouka: [0, 0, 0, 0, 0, 0, 4], api_taisen: [34, 60] },
  });
  assert.equal(toasts[0].message, '🔧 改修成功：对潜 +4/+5');

  // api_taisen[1] === 0 marks a ship that cannot be improved for asw at all.
  const noAsw = harness();
  const noAswToasts = run(noAsw, {
    after: { api_kyouka: [0, 0, 0, 0, 0, 0, 4], api_taisen: [4, 0] },
    before: { aswCur: 0 },
  });
  assert.equal(noAswToasts[0].message, '🔧 改修成功：对潜 +4/+0');
});

test('a missing ship catalog degrades to the gain alone instead of guessing the remaining room', () => {
  const h = harness();
  const toasts = run(h, {
    caps: null,
    after: { api_kyouka: [2, 1, 0, 0, 0, 0, 0], api_karyoku: [22, 22], api_raisou: [25, 25] },
  });
  assert.equal(toasts[0].message, '🔧 改修成功：火力 +2、雷装 +1');
});

test('nothing is published when the toast is switched off, the ship is unknown, or no stat moved', () => {
  const off = harness();
  off.bus.setAlertConfig({ enablePowerupResultToast: false });
  assert.equal(run(off, { after: { api_kyouka: [2, 0, 0, 0, 0, 0, 0], api_karyoku: [22, 22] } }).length, 0);

  const muted = harness();
  muted.bus.setAlertConfig({ enableToast: false });
  assert.equal(run(muted, { after: { api_kyouka: [2, 0, 0, 0, 0, 0, 0], api_karyoku: [22, 22] } }).length, 0);

  // No pre-modernization snapshot: the gain cannot be derived, so stay silent.
  const unknown = harness();
  unknown.state.caps.set(MASTER_ID, CAPS);
  unknown.modernization.publishModernizationAlert(dump(1, [ship({ api_karyoku: [22, 22] })]));
  assert.equal(unknown.state.toasts.length, 0);

  // Success with every stat unchanged (rare) must not interrupt the player.
  const flat = harness();
  assert.equal(run(flat, { after: {} }).length, 0);
});

test('unrelated endpoints and unsuccessful responses are ignored', () => {
  const h = harness();
  h.state.ships.set(UID, before());
  h.state.caps.set(MASTER_ID, CAPS);

  h.modernization.publishModernizationAlert({
    url: 'http://x/kcsapi/api_req_kousyou/remodel_slot',
    requestBody: `api_id=${UID}`,
    responseText: 'svdata={"api_result":1,"api_data":{"api_powerup_flag":1}}',
  });
  h.modernization.publishModernizationAlert({
    url: 'http://x/kcsapi/api_req_kaisou/powerup',
    requestBody: `api_id=${UID}`,
    responseText: 'svdata={"api_result":0,"api_data":null}',
  });
  h.modernization.publishModernizationAlert({
    url: 'http://x/kcsapi/api_req_kaisou/powerup',
    requestBody: `api_id=${UID}`,
    responseText: 'not json',
  });
  assert.equal(h.state.toasts.length, 0);
});

test('two consecutive modernizations both surface; the bus debounce does not swallow the second', () => {
  const h = harness();
  const toasts = run(h, {
    after: { api_kyouka: [2, 0, 0, 0, 0, 0, 0], api_karyoku: [22, 22] },
  });
  assert.equal(toasts.length, 1);

  // Same ship, same stat, same gain, 200 ms later: inside the 1200 ms debounce window.
  h.state.now += 200;
  h.state.ships.set(UID, before({ fireCur: 22 }));
  h.modernization.publishModernizationAlert(dump(1, [ship({
    api_kyouka: [4, 0, 0, 0, 0, 0, 0], api_karyoku: [24, 24],
  })]));
  assert.equal(toasts.length, 2);
  assert.equal(toasts[1].message, '🔧 改修成功：火力 +2/+1');
});

test('the ingest hook runs before the generic state extraction overwrites the pre-modernization state', () => {
  const ingest = fs.readFileSync(
    path.join(root, 'features/router/persist/ingest/webDump.ets'), 'utf8');
  const hook = ingest.indexOf('publishModernizationAlert(dump)');
  const extract = ingest.indexOf('extractAndUpdateState(apiData)');
  const parse = ingest.indexOf('executeParseResult(result, deps)');
  assert.ok(hook > 0 && extract > 0 && parse > 0, 'all three call sites are present');
  assert.ok(hook < extract, 'the snapshot must be taken before extractAndUpdateState');
  assert.ok(hook < parse, 'and before the parser/handler stage');
});
