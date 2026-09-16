// Runs real component state methods with fake game data and a controllable clock.
// Usage: node scripts/test-trifold-dashboard.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');
const panelRoot = 'app/pages/components/panel/common/';

function compile(source, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, { exports, ...globals });
  return exports;
}

function componentLogic(relativePath, globals = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const boundary = source.search(/\r?\n  (?:@Builder|build\(\))/);
  assert.ok(boundary > 0);
  const logic = source.slice(0, boundary).replace(/(?:export default )?struct \w+/, 'export default class Logic') + '\n}';
  const parsed = ts.createSourceFile('Logic.ts', logic, ts.ScriptTarget.Latest, true);
  const members = parsed.statements.find(ts.isClassDeclaration).members;
  const methods = members.filter(ts.isMethodDeclaration).map(node => node.getText(parsed)).join('\n');
  const constants = parsed.statements.filter(ts.isVariableStatement).map(node => node.getText(parsed)).join('\n');
  return compile(`${constants}\nexport default class Logic { ${methods} }`, globals).default;
}

function dashboardLogic(globals = {}) {
  const memory = new Map();
  return componentLogic(`${panelRoot}TriFoldDashboard.ets`, {
    AppStorage: {
      get: key => memory.get(key),
      setOrCreate: (key, value) => { memory.set(key, value); },
    },
    kvGetNumber: async (_key, fallback) => fallback,
    kvSet: async () => {},
    getDecks: () => [], getQuests: () => [], getNDocks: () => [],
    getRepositoryHub: () => ({ mission: { listAll: async () => [] } }),
    subscribeGameState: () => () => {},
    console: { warn: () => {} },
    ...globals,
  });
}

function dashboardInstance(Dashboard) {
  const h = new Dashboard();
  Object.assign(h, {
    activeKind: 0, kindLoadSeq: 0, missionLoadSeq: 0, unsubscribe: null,
    scroller: { scrollTo: () => {} },
  });
  return h;
}

const flushAsync = () => new Promise(resolve => setImmediate(resolve));

test('dashboard cycles all three views and resets scrolling without changing its host', () => {
  const Dashboard = dashboardLogic();
  const h = dashboardInstance(Dashboard);
  const offsets = [];
  h.activeKind = 0;
  h.scroller = { scrollTo: options => offsets.push([options.xOffset, options.yOffset]) };
  h.nextKind(); assert.equal(h.activeKind, 1);
  h.nextKind(); assert.equal(h.activeKind, 2);
  h.nextKind(); assert.equal(h.activeKind, 0);
  assert.deepEqual(offsets, [[0, 0], [0, 0], [0, 0]]);
});

test('dashboard refreshes live snapshots and removes its subscription on disappearance', async () => {
  let listener;
  let quests = [{ questId: 1, state: 2 }];
  let docks = [{ dockId: 1, state: 1 }];
  const Dashboard = dashboardLogic({
    getDecks: () => [{ deckId: 2 }], getQuests: () => quests, getNDocks: () => docks,
    getRepositoryHub: () => ({ mission: { listAll: async () => [] } }),
    subscribeGameState: callback => { listener = callback; return () => { listener = null; }; },
  });
  const h = dashboardInstance(Dashboard);
  h.missionLoadSeq = 0;
  h.aboutToAppear();
  assert.equal(h.decks[0].deckId, 2);
  assert.equal(h.quests[0].questId, 1);
  quests = [{ questId: 2, state: 3 }];
  listener('quests');
  assert.equal(h.quests[0].questId, 2);
  assert.equal(h.quests[0].state, 3);
  docks = [];
  listener('ndocks');
  assert.equal(h.ndocks.length, 0);
  h.aboutToDisappear();
  assert.equal(listener, null);
  await Promise.resolve();
});

test('late mission lookups cannot overwrite a newer result or update an unmounted dashboard', async () => {
  const pending = [];
  const Dashboard = dashboardLogic({
    getRepositoryHub: () => ({ mission: { listAll: () => new Promise(resolve => pending.push(resolve)) } }),
  });
  const h = dashboardInstance(Dashboard);
  h.missionLoadSeq = 0;
  h.unsubscribe = null;
  const first = h.loadMissions();
  const second = h.loadMissions();
  pending[1]([{ id: 2, name: 'new' }]);
  await second;
  pending[0]([{ id: 1, name: 'stale' }]);
  await first;
  assert.equal(h.missions[0].id, 2);
  const third = h.loadMissions();
  h.aboutToDisappear();
  pending[2]([{ id: 3 }]);
  await third;
  assert.equal(h.missions[0].id, 2);
});

test('selected card survives immediate remounts and restores from disk after a fresh launch', async () => {
  const disk = new Map();
  let reads = 0;
  const storage = {
    kvGetNumber: async (key, fallback) => { reads++; return disk.get(key) ?? fallback; },
    kvSet: async (key, value) => { disk.set(key, value); },
  };
  const Dashboard = dashboardLogic(storage);
  let h = dashboardInstance(Dashboard);
  h.aboutToAppear();
  await flushAsync();
  for (const selected of [1, 2, 0, 1, 2]) {
    h.nextKind();
    assert.equal(h.activeKind, selected);
    h.aboutToDisappear();
    h = dashboardInstance(Dashboard);
    h.aboutToAppear();
    assert.equal(h.activeKind, selected, 'remount restores synchronously before pending saves finish');
  }
  assert.equal(reads, 1, 'folding and rotating do not reload stale disk preferences');
  h.aboutToDisappear();
  await flushAsync();
  const FreshDashboard = dashboardLogic(storage);
  const fresh = dashboardInstance(FreshDashboard);
  fresh.aboutToAppear();
  await flushAsync();
  assert.equal(fresh.activeKind, 2, 'a fresh app storage restores the last saved repair card');
  assert.equal(reads, 2);
  fresh.aboutToDisappear();
});

test('late preference reads cannot override a new selection or update an unmounted card', async () => {
  const pending = [];
  const Dashboard = dashboardLogic({
    kvGetNumber: () => new Promise(resolve => pending.push(resolve)),
  });
  const first = dashboardInstance(Dashboard);
  first.aboutToAppear();
  first.aboutToDisappear();
  const second = dashboardInstance(Dashboard);
  second.aboutToAppear();
  second.nextKind();
  pending[1](2);
  pending[0](2);
  await flushAsync();
  assert.equal(first.activeKind, 0, 'unmounted card ignores its outstanding read');
  assert.equal(second.activeKind, 1, 'late disk data cannot replace a newer user choice');
  second.aboutToDisappear();
  const third = dashboardInstance(Dashboard);
  third.aboutToAppear();
  assert.equal(third.activeKind, 1, 'the newer choice also survives the next remount');
  assert.equal(pending.length, 2, 'cached selection bypasses disk');
  third.aboutToDisappear();
});

test('card saves stay ordered across remounts and a failed write does not block the next save', async () => {
  const writes = [];
  const warnings = [];
  let saved = 0;
  const Dashboard = dashboardLogic({
    kvSet: (key, value) => new Promise((resolve, reject) => {
      writes.push({ key, value, finish: () => { saved = value; resolve(); }, reject });
    }),
    console: { warn: (...args) => warnings.push(args) },
  });
  const first = dashboardInstance(Dashboard);
  first.nextKind();
  first.aboutToDisappear();
  const second = dashboardInstance(Dashboard);
  second.aboutToAppear();
  assert.equal(second.activeKind, 1);
  second.nextKind();
  await flushAsync();
  assert.deepEqual(writes.map(write => write.value), [1], 'only one write may be in flight');
  writes[0].reject(new Error('disk unavailable'));
  await flushAsync();
  assert.deepEqual(writes.map(write => write.value), [1, 2]);
  assert.equal(writes[0].key, writes[1].key);
  assert.equal(warnings.length, 1);
  writes[1].finish();
  await flushAsync();
  assert.equal(saved, 2);
  assert.equal(second.activeKind, 2);
  second.aboutToDisappear();
});

test('invalid or unreadable saved selections safely use the default card', async () => {
  for (const value of [-1, 3, 1.5, NaN, Infinity]) {
    const Dashboard = dashboardLogic({ kvGetNumber: async () => value });
    const h = dashboardInstance(Dashboard);
    await h.restoreActiveKind();
    assert.equal(h.activeKind, 0);
  }
  const Dashboard = dashboardLogic({ kvGetNumber: async () => { throw new Error('read failed'); } });
  const h = dashboardInstance(Dashboard);
  await h.restoreActiveKind();
  assert.equal(h.activeKind, 0);
  h.nextKind();
  const recreated = dashboardInstance(Dashboard);
  await recreated.restoreActiveKind();
  assert.equal(recreated.activeKind, 1, 'a read failure does not prevent remembering later selections');
});

test('expedition countdown handles elapsed, subsecond and cross-midnight returns and clears its timer', () => {
  let now = new Date(2026, 8, 15, 23, 59, 59).getTime();
  const timers = new Map();
  let nextId = 1;
  class FakeDate extends Date { static now() { return now; } }
  const Expedition = componentLogic(`${panelRoot}ExpeditionStatusPanel.ets`, {
    Date: FakeDate,
    setTimeout: callback => { const id = nextId++; timers.set(id, callback); return id; },
    clearTimeout: id => { timers.delete(id); },
  });
  const h = new Expedition();
  h.tickTimer = -1;
  h.missions = [{ id: 5, code: 'A1', name: 'Test expedition' }];
  const running = { deckId: 2, expeditionMissionId: 5, expeditionReturnTime: now + 2000 };
  h.decks = [
    { deckId: 4, expeditionMissionId: 5, expeditionReturnTime: now - 1000 },
    { deckId: 3, expeditionMissionId: 0, expeditionReturnTime: null }, running,
  ];
  h.aboutToAppear();
  assert.equal(timers.size, 1);
  assert.deepEqual(Array.from(h.activeDecks(), deck => deck.deckId), [2, 4]);
  assert.equal(h.remainingText(running), '0:00:02');
  assert.equal(h.returnTimeText(running), '归来 9/16 00:00:01');
  assert.equal(h.missionName(running), 'A1 · Test expedition');
  assert.equal(h.remainingText({ expeditionReturnTime: now + 1 }), '0:00:01');
  now += 2000;
  const [id, callback] = timers.entries().next().value;
  timers.delete(id);
  callback();
  assert.equal(h.remainingText(running), '已归来');
  assert.equal(timers.size, 1);
  h.aboutToDisappear();
  assert.equal(timers.size, 0);
  assert.equal(h.remainingText({ expeditionReturnTime: null }), '--');
  assert.equal(h.returnTimeText({ expeditionReturnTime: null }), '归来时间未知');
});

test('dashboard quests include completed rewards while existing quest panels keep their filter', () => {
  const Quest = componentLogic(`${panelRoot}QuestPanel.ets`);
  const h = new Quest();
  h.quests = [{ questId: 1, state: 1 }, { questId: 2, state: 2 }, { questId: 3, state: 3 }];
  h.includeCompleted = false;
  assert.deepEqual(Array.from(h.visibleQuests(), quest => quest.questId), [2]);
  h.includeCompleted = true;
  assert.deepEqual(Array.from(h.visibleQuests(), quest => quest.questId), [2, 3]);
});

test('three-pane scale settings normalize and retain the existing persisted preference key', () => {
  const gameSize = compile(fs.readFileSync(path.join(root, 'infra/web/layout/gameSize.ets'), 'utf8'), {
    require: () => ({ GAME_ASPECT_RATIO: 1200 / 720 }),
  });
  const writes = [];
  const Settings = componentLogic('app/pages/Setting.ets', {
    normalizeGameSizePercent: gameSize.normalizeGameSizePercent,
    APP_STORAGE_GAME_SIZE_TRIFOLD: 'ui.gameSize.triFoldPortrait',
    kvSet: (key, value) => { writes.push([key, value]); },
  });
  const h = new Settings();
  h.compactGameSizePercent = 65;
  h.expandedGameSizePercent = 85;
  h.triFoldGameSizePercent = 100;
  h.setTriFoldGameSizePercent(77);
  assert.equal(h.triFoldGameSizePercent, 75);
  assert.equal(h.compactGameSizePercent, 65);
  assert.equal(h.expandedGameSizePercent, 85);
  assert.deepEqual(writes, [['ui.gameSize.triFoldPortrait', 75]]);
  h.setTriFoldGameSizePercent(75);
  assert.equal(writes.length, 1);
  h.setTriFoldGameSizePercent(30);
  assert.equal(h.triFoldGameSizePercent, 60);
  h.setTriFoldGameSizePercent(NaN);
  assert.equal(h.triFoldGameSizePercent, 100);
});
