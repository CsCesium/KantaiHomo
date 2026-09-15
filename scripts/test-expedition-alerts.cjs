// Runs the real service code with in-memory platform adapters and a controllable clock.
// Usage: node scripts/test-expedition-alerts.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets/features/alerts');

function harness() {
  const state = {
    now: new Date(2026, 8, 15, 23, 59, 0).getTime(),
    permission: true, preference: true, failPublish: false, failCancel: false,
    rows: [], decks: [], reminders: [], published: [], cancelled: [], notifications: [],
    notificationEvents: [], timers: new Map(), storage: new Map(), listeners: [],
    nextId: 1, nextTimer: 1, publishGate: null, toasts: [], vibrations: [], alertHandler: null,
  };
  class TestDate extends Date {
    static now() { return state.now; }
  }
  const notification = {
    SlotType: { OTHER_TYPES: 0, SERVICE_INFORMATION: 1 },
    ContentType: { NOTIFICATION_CONTENT_MULTILINE: 4, NOTIFICATION_CONTENT_BASIC_TEXT: 0 },
    isNotificationEnabled: async () => state.permission,
    requestEnableNotification: async () => { state.permission = true; },
    publish: async request => {
      if (state.publishGate) await state.publishGate;
      state.notifications.push(request);
      state.notificationEvents.push('publish');
    },
    cancel: async () => { state.notificationEvents.push('cancel'); },
  };
  const reminderAgentManager = {
    ReminderType: { REMINDER_TYPE_TIMER: 0, REMINDER_TYPE_CALENDAR: 1 },
    RingChannel: { RING_CHANNEL_NOTIFICATION: 2 },
    ActionButtonType: { ACTION_BUTTON_TYPE_CLOSE: 0 },
    getAllValidReminders: async () => state.reminders.slice(),
    publishReminder: async request => {
      if (state.failPublish) throw new Error('temporary publish failure');
      assert.equal(state.permission, true, 'never publish before permission');
      const reminderId = state.nextId++;
      state.published.push(request);
      state.reminders.push({ reminderId, reminderReq: request });
      return reminderId;
    },
    cancelReminder: async id => {
      if (state.failCancel) throw Object.assign(new Error('cancel failed'), { code: 1700004 });
      state.cancelled.push(id);
      state.reminders = state.reminders.filter(item => item.reminderId !== id);
    },
  };
  const adapters = {
    '@ohos.promptAction': { default: { showToast: request => state.toasts.push(request) } },
    '@ohos.vibrator': { default: { startVibration: async request => state.vibrations.push(request) } },
    '.': { getAlertBus: () => ({
      getConfig: () => ({ enableToast: true, enableVibrate: true, enableNotification: true, vibrateDurationMs: 150 }),
      subscribeAll: handler => { state.alertHandler = handler; },
    }) },
    '../resources/resourceMeta': { resourceGainName: () => '' },
    '@ohos.notificationManager': { default: notification },
    '@kit.BackgroundTasksKit': { reminderAgentManager },
    '../../../infra/storage/repo': { getRepositoryHub: () => ({
      expedition: { list: async () => state.rows.map(row => ({ ...row })) },
      deck: { list: async () => state.decks.slice() },
    }) },
    '../../../infra/storage/kv': {
      kvGetBool: async () => state.preference,
      kvSet: async (_, enabled) => { state.preference = enabled; },
    },
    '../../../infra/appContext': { getAppContext: () => ({}) },
    './missionCache': { getMissionName: id => `任务 ${id}` },
    './expeditionTrigger': { addOnExpeditionChanged: callback => {
      state.listeners.push(callback);
      return () => { state.listeners = state.listeners.filter(item => item !== callback); };
    } },
    './launchWantAgent': { getLaunchWantAgent: async () => ({}) },
  };
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const file = path.join(sourceRoot, 'module', name);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: name.replace(/\.ets$/, '.ts'),
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exports = {};
    vm.runInNewContext(output, {
      exports, Date: TestDate, console: { info() {}, debug() {}, warn() {} },
      setTimeout: callback => { const id = state.nextTimer++; state.timers.set(id, callback); return id; },
      clearTimeout: id => state.timers.delete(id),
      AppStorage: { setOrCreate: (key, value) => state.storage.set(key, value) },
      require: name => {
        if (name === './expeditionTime') return load('expeditionTime.ts');
        if (name === './module/expeditionReminder') return load('expeditionReminder.ets');
        if (name === './module/expeditionNotification') return load('expeditionNotification.ets');
        if (name === './module/missionCache') return adapters['./missionCache'];
        if (name === './module/launchWantAgent') return adapters['./launchWantAgent'];
        assert.ok(adapters[name], `unexpected platform dependency: ${name}`);
        return adapters[name];
      },
    }, { filename: file });
    modules.set(name, exports);
    return exports;
  }
  state.row = (deckId = 2, offset = 120_000) => ({
    deckId, missionId: 5, progress: 1, returnTime: state.now + offset,
  });
  state.reminderService = () => load('expeditionReminder.ets').getExpeditionReminderService();
  state.liveService = () => load('expeditionNotification.ets').getExpeditionLiveNotificationService();
  state.permissionRequest = () => load('notificationPermission.ets').ensureNotificationPermission();
  state.fireReturn = async row => {
    load('../executor.ets').initAlertExecutor();
    await state.alertHandler({ type: 'expedition_return', deckId: row.deckId,
      missionId: row.missionId, timestamp: row.returnTime });
  };
  state.tick = async () => {
    const pending = [...state.timers.values()];
    state.timers.clear();
    for (const callback of pending) await callback();
  };
  return state;
}

test('granting permission registers existing fleets at an absolute time across midnight', async () => {
  const h = harness();
  h.permission = false;
  h.rows = [h.row(2, 120_123), h.row(3, 240_000)];
  const service = h.reminderService();
  await service.start();
  assert.equal(h.published.length, 0);
  await h.permissionRequest();
  await service.syncFromDb();
  assert.equal(h.published.length, 2);
  const request = h.published[0];
  assert.equal(request.reminderType, 1);
  assert.equal(request.ringChannel, 2, 'use the notification sound channel');
  assert.equal(request.dateTime.day, 16);
  assert.equal(request.dateTime.hour, 0);
  assert.equal(request.dateTime.minute, 1);
  assert.equal(request.dateTime.second, 1, 'round up to avoid an early alarm');
  assert.equal(request.content, '第 2 舰队「任务 5」已到归来时间（00:01:00）');
  await service.syncFromDb();
  assert.equal(h.published.length, 2, 'idempotent reconciliation');
});

test('a reminder at its due time survives reconciliation and window teardown', async () => {
  const h = harness();
  const target = h.row();
  h.rows = [target];
  const service = h.reminderService();
  await service.start();
  h.now = target.returnTime;
  await service.syncFromDb();
  assert.equal(h.cancelled.length, 0);
  assert.ok(service.hasSystemReminder(2, 5, target.returnTime));
  h.reminders = []; // The system expires it while the process remains alive.
  await service.syncFromDb();
  assert.ok(service.hasSystemReminder(2, 5, target.returnTime), 'foreground must not ring again');
  assert.equal(h.published.length, 1, 'never recreate an overdue reminder');
  service.stop();
  assert.equal(h.cancelled.length, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.length, 0);
});

test('return time changes and collected results replace or cancel only expedition reminders', async () => {
  const h = harness();
  h.rows = [h.row()];
  const service = h.reminderService();
  await service.start();
  h.reminders.push({ reminderId: 99, reminderReq: { groupId: 'unrelated', notificationId: 99 } });
  h.rows[0].returnTime += 30_000;
  await service.syncFromDb();
  assert.deepEqual(h.cancelled, [1]);
  assert.equal(h.published.length, 2);
  h.rows[0].progress = 0;
  await service.syncFromDb();
  assert.deepEqual(h.cancelled, [1, 2]);
  assert.equal(h.reminders[0].reminderId, 99);
});

test('disabled reminders are cancelled, and permission alone does not re-enable them', async () => {
  const h = harness();
  h.rows = [h.row()];
  const service = h.reminderService();
  await service.start();
  await service.setEnabled(false);
  assert.equal(h.reminders.length, 0);
  assert.equal(h.preference, false);
  await service.syncFromDb();
  assert.equal(h.published.length, 1);
  await service.setEnabled(true);
  assert.equal(h.published.length, 2);
});

test('temporary publish failures retry without a new game event', async () => {
  const h = harness();
  h.rows = [h.row()];
  h.failPublish = true;
  const service = h.reminderService();
  await service.start();
  assert.match(h.storage.get('alerts.expedition.system.status'), /失败/);
  assert.equal(service.hasSystemReminder(2, 5, h.rows[0].returnTime), false);
  h.failPublish = false;
  await h.tick();
  assert.equal(h.published.length, 1);
  assert.match(h.storage.get('alerts.expedition.system.status'), /已登记 1/);
});

test('cancellation failures are retried before registering a replacement', async () => {
  const h = harness();
  h.rows = [h.row()];
  const service = h.reminderService();
  await service.start();
  h.rows[0].returnTime += 10_000;
  h.failCancel = true;
  await service.syncFromDb();
  assert.equal(h.published.length, 1);
  assert.match(h.storage.get('alerts.expedition.system.status'), /失败/);
  h.failCancel = false;
  await h.tick();
  assert.equal(h.published.length, 2);
  assert.equal(h.reminders.length, 1);
});

test('future legacy timers migrate, due legacy timers remain, duplicate entries are removed', async () => {
  const h = harness();
  h.rows = [h.row(2), h.row(3, -1)];
  h.reminders = h.rows.map((row, index) => ({ reminderId: 10 + index, reminderReq: {
    reminderType: 0, notificationId: 1000 + row.deckId,
    groupId: `kchomo.expedition.${row.deckId}.${row.missionId}.${row.returnTime}`,
  } }));
  const service = h.reminderService();
  await service.start();
  assert.deepEqual(h.cancelled, [10]);
  assert.equal(h.published.length, 1);
  h.reminders.push({ ...h.reminders.find(item => item.reminderId === 1), reminderId: 12 });
  await service.syncFromDb();
  assert.deepEqual(h.cancelled, [10, 12]);
});

test('future calendar reminders update old text without changing their trigger, and due reminders remain', async () => {
  const h = harness();
  h.rows = [h.row(2), h.row(3, 60_000)];
  const service = h.reminderService();
  await service.start();
  const future = h.reminders.find(item => item.reminderReq.notificationId === 1002);
  const due = h.reminders.find(item => item.reminderReq.notificationId === 1003);
  const original = future.reminderReq;
  future.reminderReq.content = '旧提醒：预计 09-16 00:01:00 归来';
  due.reminderReq.content = '旧提醒：预计 09-16 00:00:00 归来';
  h.now = h.rows[1].returnTime;
  await service.syncFromDb();
  assert.deepEqual(h.cancelled, [future.reminderId]);
  assert.equal(h.published.length, 3);
  const replacement = h.published.at(-1);
  assert.deepEqual(replacement.dateTime, original.dateTime);
  assert.equal(replacement.groupId, original.groupId);
  assert.equal(replacement.notificationId, original.notificationId);
  assert.equal(replacement.content, '第 2 舰队「任务 5」已到归来时间（00:01:00）');
  assert.ok(h.reminders.includes(due));
  await service.syncFromDb();
  assert.equal(h.published.length, 3, 'updated text must not cause repeated registration');
});

test('cold restart discovers registered reminders and concurrent syncs do not duplicate them', async () => {
  const h = harness();
  h.rows = [h.row()];
  await h.reminderService().start();
  const restarted = harness();
  restarted.rows = h.rows;
  restarted.reminders = h.reminders;
  const service = restarted.reminderService();
  await service.start();
  await Promise.all([service.syncFromDb(), service.syncFromDb(), service.syncFromDb()]);
  assert.equal(restarted.published.length, 0);
  assert.ok(service.hasSystemReminder(2, 5, h.rows[0].returnTime));
});

test('time table includes absolute times without deck metadata, updates on events, and skips unchanged publishes', async () => {
  const h = harness();
  h.rows = [h.row()];
  const live = h.liveService();
  await live.start();
  assert.equal(h.notifications[0].content.multiLine.lines[0], '第2舰队: 任务 5  00:01:00');
  assert.equal(h.notifications[0].content.multiLine.longTitle, '归来：第2舰队「任务 5」 00:01:00');
  await live.refresh();
  assert.equal(h.notifications.length, 1);
  h.rows[0].returnTime += 60_000;
  h.listeners[0]();
  await live.refresh();
  assert.equal(h.notifications.length, 2);
  assert.match(h.notifications[1].content.multiLine.lines[0], /00:02:00/);
  h.rows = [];
  await live.refresh();
  assert.equal(h.notificationEvents.at(-1), 'cancel');
});

test('stopping during publication leaves the final notification cancelled', async () => {
  const h = harness();
  h.rows = [h.row()];
  let release;
  h.publishGate = new Promise(resolve => { release = resolve; });
  const live = h.liveService();
  const starting = live.start();
  await new Promise(resolve => setImmediate(resolve));
  live.stop();
  release();
  await starting;
  await live.refresh();
  assert.deepEqual(h.notificationEvents, ['publish', 'cancel']);
  assert.equal(h.timers.size, 0);
});

test('the foreground executor avoids duplicate sound and notification for system-owned returns', async () => {
  const h = harness();
  h.rows = [h.row()];
  await h.reminderService().start();
  h.now = h.rows[0].returnTime;
  await h.fireReturn(h.rows[0]);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.vibrations.length, 0);
  assert.equal(h.notifications.length, 0);
});

test('the foreground executor still alerts when system registration failed', async () => {
  const h = harness();
  h.rows = [h.row()];
  h.failPublish = true;
  await h.reminderService().start();
  h.now = h.rows[0].returnTime;
  await h.fireReturn(h.rows[0]);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.vibrations.length, 1);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0].id, 1002);
});
