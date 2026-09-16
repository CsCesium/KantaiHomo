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

test('dashboard cycles all three views and resets scrolling without changing its host', () => {
  const Dashboard = componentLogic(`${panelRoot}TriFoldDashboard.ets`);
  const h = new Dashboard();
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
  const Dashboard = componentLogic(`${panelRoot}TriFoldDashboard.ets`, {
    getDecks: () => [{ deckId: 2 }], getQuests: () => quests, getNDocks: () => docks,
    getRepositoryHub: () => ({ mission: { listAll: async () => [] } }),
    subscribeGameState: callback => { listener = callback; return () => { listener = null; }; },
  });
  const h = new Dashboard();
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
  const Dashboard = componentLogic(`${panelRoot}TriFoldDashboard.ets`, {
    getRepositoryHub: () => ({ mission: { listAll: () => new Promise(resolve => pending.push(resolve)) } }),
  });
  const h = new Dashboard();
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
