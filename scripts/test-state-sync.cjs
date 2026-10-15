// node scripts/test-state-sync.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');
const quiet = { log() {}, debug() {}, info() {}, warn() {}, error() {} };

function load(file, adapters = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, console: quiet, setTimeout, clearTimeout, ...globals,
    require(spec) {
      if (Object.hasOwn(adapters, spec)) return adapters[spec];
      if (spec.includes('/handlers/') || spec.endsWith('/parsers/pipelines')) return {};
      throw new Error(`Missing adapter: ${spec}`);
    },
  }, { filename: file });
  return exports;
}

function timers() {
  const pending = new Map();
  let next = 1;
  return {
    pending,
    setTimeout(fn, delay) { const id = next++; pending.set(id, { fn, delay }); return id; },
    clearTimeout(id) { pending.delete(id); },
    run(delay) {
      const entry = [...pending].find(([, task]) => delay === undefined || task.delay === delay);
      if (!entry) return false;
      pending.delete(entry[0]); entry[1].fn(); return true;
    },
  };
}
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const packet = (name, extra = {}) => JSON.stringify({ type: 'API_DUMP',
  url: `/kcsapi/${name}`, requestBody: '', responseText: '{"api_result":1,"api_data":{}}', ...extra });
function browser() {
  const clock = timers();
  const events = new Map();
  const flags = new Set();
  const win = { addEventListener: (name, fn) => events.set(name, fn),
    __safeInject: (name, fn) => { if (!flags.has(name)) { flags.add(name); fn(); } } };
  const context = vm.createContext({ window: win, document: {
    hidden: false, addEventListener: (name, fn) => events.set(name, fn),
  }, console: quiet, ...clock, URLSearchParams });
  const { bridgeSnippet } = load('infra/web/inject/modules/bridge.ts');
  vm.runInContext(bridgeSnippet('hmos', 'post'), context);
  return { win, clock, events, context };
}

test('bridge recovers after proxy loss and preserves response order across visibility changes', () => {
  const { win, clock, events } = browser();
  win.__hm_send(packet('api_req_hensei/change'));
  win.__hm_send(packet('api_req_map/next'));
  const received = [];
  win.hmos = { post: raw => received.push(JSON.parse(raw)) };
  events.get('visibilitychange')();
  assert.equal(received[0].url, '/kcsapi/api_req_hensei/change');
  const trace = received[0].trace;
  clock.run(500); // Lost native ACK: resend the same packet, never the next packet.
  assert.equal(received.at(-1).trace, trace);
  win.__hm_ack('wrong-trace');
  assert.equal(win.__hm_q.length, 2);
  win.__hm_ack(trace);
  clock.run(0);
  assert.equal(received.at(-1).url, '/kcsapi/api_req_map/next');
  win.__hm_ack(received.at(-1).trace);
  clock.run(0);
  assert.equal(win.__hm_q.length, 0);
});

test('bridge retains packets when post throws after being available for a long session', () => {
  const { win, clock, events } = browser();
  win.hmos = { post: () => { throw new Error('proxy unavailable'); } };
  win.__hm_send(packet('api_port/port'));
  assert.equal(win.__hm_q.length, 1);
  const received = [];
  win.hmos = { post: raw => received.push(JSON.parse(raw)) };
  events.get('online')();
  assert.equal(received.length, 1);
  win.__hm_ack(received[0].trace);
  clock.run(0);
  assert.equal(win.__hm_q.length, 0);
});

test('malformed legacy packets cannot block later fleet responses', () => {
  const { win, clock } = browser();
  win.__hm_q.push('not-json', '{"type":"API_DUMP"}');
  win.__hm_send(packet('api_port/port'));
  const received = [];
  win.hmos = { post: raw => received.push(raw) };
  clock.run(500);
  assert.equal(received.length, 3);
  assert.equal(JSON.parse(received.at(-1)).url, '/kcsapi/api_port/port');
  win.__hm_ack(JSON.parse(received.at(-1)).trace);
  clock.run(0);
  assert.equal(win.__hm_q.length, 0);
});

test('reused XHR emits each successful response once and ignores failed/offline requests', () => {
  const { context, win } = browser();
  class Xhr {
    constructor() { this.listeners = new Set(); }
    open(_method, url) { this.responseURL = url; this.readyState = 1; }
    send() {}
    addEventListener(_name, fn) { this.listeners.add(fn); }
    removeEventListener(_name, fn) { this.listeners.delete(fn); }
    complete(status) {
      this.status = status; this.responseText = 'svdata={"api_result":1}'; this.readyState = 4;
      for (const fn of [...this.listeners]) fn();
    }
  }
  context.XMLHttpRequest = Xhr;
  const { hookXhrSnippet } = load('infra/web/inject/modules/hookXHR.ts');
  vm.runInContext(hookXhrSnippet('hmos', 'post', '/\\/kcsapi\\//'), context);
  const xhr = new Xhr();
  xhr.open('POST', '/kcsapi/api_req_hensei/change'); xhr.send('api_id=1'); xhr.complete(200);
  xhr.open('POST', '/kcsapi/api_port/port'); xhr.send(''); xhr.complete(200);
  xhr.open('POST', '/kcsapi/api_port/port'); xhr.send(''); xhr.complete(0);
  assert.equal(win.__hm_q.length, 2);
  assert.equal(xhr.listeners.size, 0);
  assert.equal(JSON.parse(win.__hm_q[0]).requestBody, 'api_id=1');
});

test('fetch uses the same ordered delivery queue and does not route API packets to RPC', async () => {
  const { context, win } = browser();
  let rpcCalls = 0;
  win.hmos = { postAsync: () => { rpcCalls++; } };
  win.fetch = async () => ({ status: 200, headers: { get: () => 'application/json' },
    clone: () => ({ text: async () => 'svdata={"api_result":1}' }) });
  const { hookFetchSnippet } = load('infra/web/inject/modules/hookFetch.ts');
  vm.runInContext(hookFetchSnippet('hmos', 'post', '/\\/kcsapi\\//'), context);
  await win.fetch('/kcsapi/api_port/port', { method: 'POST', body: 'api_id=1' });
  assert.equal(rpcCalls, 0);
  assert.equal(win.__hm_q.length, 1);
  assert.ok(JSON.parse(win.__hm_q[0]).trace);
});

function native(ingest, initialDeps = {}) {
  const clock = timers();
  let deps = initialDeps;
  const acknowledgments = [];
  const types = load('infra/web/types.ts');
  const adapters = {
    '@kit.ArkWeb': {}, '@ohos.display': {}, '@ohos.app.ability.common': {},
    '../bridge/WebBridge': { WebBridge: class {} },
    '../layout/fit': { FitAndDisplay: class {} },
    '../../web/inject': {}, '../inject/modules/audioMute': {}, '../types': types,
    '../../../features/router/persist/ingest/webDump': { ingestDump: ingest },
    '../../deps/index': { getPersistDeps: () => deps }, '../config': {},
    '../layout/orientation': { Orientation: class {} }, '@ohos.hilog': { default: quiet },
    '../../../features/alerts': {}, '../../../features/alerts/lastBattleState': {},
    '../../../features/state': {},
  };
  const { WebHostController } = load('infra/web/controller/WebHostController.ets', adapters, clock);
  const ctl = { runJavaScript: js => {
    vm.runInNewContext(js, { window: { __hm_ack: id => acknowledgments.push(id) } });
    return Promise.resolve('');
  } };
  const host = new WebHostController(ctl, {}, () => ({}), () => ({}), () => Promise.resolve(''));
  return { host, clock, acknowledgments, setDeps: value => { deps = value; } };
}

test('native queue keeps packets until dependencies initialize and deduplicates ACK retries', async () => {
  const received = [];
  const { host, clock, setDeps, acknowledgments } = native(async dump => received.push(dump.url), null);
  host.onHookPayload(packet('api_port/port', { trace: 'one' }));
  host.onHookPayload(packet('api_port/port', { trace: 'one' }));
  while (clock.run(0)) await tick();
  assert.equal(received.length, 0);
  assert.ok(acknowledgments.includes('one'));
  setDeps({}); clock.run(200); await tick();
  assert.deepEqual(received, ['/kcsapi/api_port/port']);
});

test('native ACK JavaScript rejection is recoverable without replaying fleet mutations', async () => {
  const received = [];
  const { host, clock, acknowledgments } = native(async dump => received.push(dump.url));
  const send = host.ctl.runJavaScript;
  host.ctl.runJavaScript = () => Promise.reject(new Error('backgrounded WebView'));
  host.onHookPayload(packet('api_req_hensei/change', { trace: 'edit' }));
  while (clock.run(0)) await tick();
  assert.equal(acknowledgments.length, 0);
  host.ctl.runJavaScript = send;
  host.onHookPayload(packet('api_req_hensei/change', { trace: 'edit' }));
  while (clock.run(0)) await tick();
  assert.deepEqual(received, ['/kcsapi/api_req_hensei/change']);
  assert.deepEqual(acknowledgments, ['edit']);
});

test('native backpressure preserves old packets and ACKs a new packet only after admission', async () => {
  const received = [];
  let release;
  const stalled = new Promise(resolve => { release = resolve; });
  const { host, clock, acknowledgments } = native(async dump => {
    received.push(dump.url); if (received.length === 1) await stalled;
  });
  host.onHookPayload(packet('first', { trace: 'first' }));
  clock.run(0); await tick();
  for (let i = 0; i < 60; i++) host.onHookPayload(packet(`next-${i}`, { trace: `next-${i}` }));
  host.onHookPayload(packet('api_port/port', { trace: 'port' }));
  while (clock.run(0)) await tick();
  assert.ok(!acknowledgments.includes('port'));
  release(); await tick();
  host.onHookPayload(packet('api_port/port', { trace: 'port' }));
  for (let i = 0; i < 10; i++) { while (clock.run(0)) await tick(); await tick(); }
  assert.equal(received.length, 62);
  assert.equal(received[1], '/kcsapi/next-0');
  assert.equal(received.at(-1), '/kcsapi/api_port/port');
  assert.ok(acknowledgments.includes('port'));
});

function ingester(worker) {
  const clock = timers();
  const dispatched = [];
  const parse = raw => { try { return JSON.parse(raw.replace(/^svdata=/, '')); } catch (_) { return null; } };
  const reminders = [];
  const adapters = {
    '@ohos.taskpool': { default: { execute: worker || (async () => ({ preEvents: [], mainEvents: [] })) } },
    './webDumpTask': { parseDumpInWorker() {} },
    '../../../parsers/pipeline': { parseDump: dump => ({ preEvents: [],
      mainEvents: [{ type: 'STATE_PACKET', payload: dump.url }] }) },
    '../executor': { dispatchEvent: async event => { dispatched.push(event.payload); } },
    '../../../utils/common': { parseSvdata: parse, parseSvdataAndUnwrap: raw => parse(raw)?.api_data,
      parseFormBody: () => ({ getInt: () => 0 }) },
    '../../../../domain/models/api/response': { detectStateFields: () => ({}) },
    '../../../state': {}, '../../../../domain/service': {},
    '../../../quests/service': { trackQuestApi: async () => {} },
    '../../../alerts/module/harborReminder': { harborFlagships: () => [],
      getHarborReminderService: () => ({ afterApi: dump => {
        reminders.push(dump.url); return new Promise(() => {});
      } }) },
    '../../../alerts/module/modernization': { publishModernizationAlert() {} },
  };
  return { ...load('features/router/persist/ingest/webDump.ets', adapters, clock), clock, dispatched, reminders };
}

test('a stalled calendar call does not block port, battle or next-node state processing', async () => {
  const { ingestDump, dispatched, reminders } = ingester();
  for (const endpoint of ['api_port/port', 'api_req_sortie/battle', 'api_req_map/next']) {
    await ingestDump(JSON.parse(packet(endpoint)), {});
  }
  assert.equal(dispatched.length, 3);
  assert.equal(reminders.length, 3);
});

test('a suspended parser worker falls back once; late completion cannot roll state back', async () => {
  let finishWorker;
  const worker = new Promise(resolve => { finishWorker = resolve; });
  const { ingestDump, dispatched, clock } = ingester(() => worker);
  const dump = JSON.parse(packet('api_port/port'));
  dump.responseText = JSON.stringify({ api_result: 1, api_data: { padding: 'x'.repeat(300000) } });
  const work = ingestDump(dump, {}); await tick();
  assert.equal(dispatched.length, 0);
  assert.ok(clock.run(3000)); await work;
  assert.deepEqual(dispatched, ['/kcsapi/api_port/port']);
  finishWorker({ preEvents: [], mainEvents: [{ type: 'STATE_PACKET', payload: 'stale' }] });
  await tick();
  assert.deepEqual(dispatched, ['/kcsapi/api_port/port']);
});

test('failed API and non-JSON network responses leave the valid state untouched', async () => {
  const { ingestDump, dispatched } = ingester();
  for (const responseText of ['', '<html>offline</html>', '{"api_result":0,"api_data":{}}']) {
    await ingestDump({ ...JSON.parse(packet('api_port/port')), responseText }, {});
  }
  assert.equal(dispatched.length, 0);
});
