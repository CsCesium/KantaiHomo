// node scripts/test-refresh-reminders.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets/features/alerts/module');

function harness(shared) {
  const state = shared || {
    now: Date.parse('2026-09-17T01:00:00+08:00'), permission: true,
    prefs: new Map(), app: new Map(), timers: new Map(), reminders: [],
    published: [], cancelled: [], slots: [], nextId: 1, nextTimer: 1,
    failPublish: false, failCancel: false, failSave: false,
  };
  class ClockDate extends Date { static now() { return state.now; } }
  const adapters = {
    '@ohos.notificationManager': { default: {
      SlotType: { CONTENT_INFORMATION: 3 }, isNotificationEnabled: async () => state.permission,
    } },
    '@kit.BackgroundTasksKit': { reminderAgentManager: {
      ReminderType: { REMINDER_TYPE_CALENDAR: 1 },
      addNotificationSlot: async slot => state.slots.push(slot),
      getAllValidReminders: async () => state.reminders.slice(),
      publishReminder: async request => {
        assert.equal(state.permission, true);
        // The native bridge distinguishes an absent optional field from an explicit undefined value.
        if (Object.hasOwn(request, 'daysOfWeek') && !Array.isArray(request.daysOfWeek)) {
          throw { code: 401, message: 'Wrong argument type:daysOfWeek. object expected.' };
        }
        if (state.publishFailure) throw state.publishFailure;
        if (state.failPublish) throw new Error('publish failed');
        assert.ok(state.reminders.length < 30, 'system reminder capacity');
        state.reminders.push({ reminderId: state.nextId++, reminderReq: request });
        state.published.push(request);
        return state.nextId - 1;
      },
      cancelReminder: async id => {
        if (state.failCancel) throw Object.assign(new Error('cancel failed'), { code: 1700004 });
        state.cancelled.push(id);
        state.reminders = state.reminders.filter(item => item.reminderId !== id);
      },
    } },
    '../../../infra/storage/kv': {
      kvGetBool: async (key, fallback) => state.prefs.get(key) ?? fallback,
      kvSet: async (key, value) => {
        if (state.failSave) throw new Error('save failed');
        state.prefs.set(key, value);
      },
    },
  };
  adapters['./calendarReminder']={calendarReminder:{
    ...adapters['@kit.BackgroundTasksKit'].reminderAgentManager,
    isEnabled:async()=>state.permission,
  }};
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(root, name), 'utf8'), {
      fileName: name.replace(/\.ets$/, '.ts'),
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Date: ClockDate, console: { warn() {} },
      AppStorage: { setOrCreate: (key, value) => state.app.set(key, value) },
      setTimeout: cb => { const id = state.nextTimer++; state.timers.set(id, cb); return id; },
      clearTimeout: id => state.timers.delete(id),
      require: spec => {
        if (spec === './refreshSchedule') return load('refreshSchedule.ts');
        assert.ok(adapters[spec], `Unexpected dependency (including toast/vibration): ${spec}`);
        return adapters[spec];
      },
    });
    modules.set(name, exports);
    return exports;
  }
  const schedule = load('refreshSchedule.ts');
  return { state, schedule, service: load('refreshReminder.ets').getRefreshReminderService() };
}
const iso = value => new Date(value).toISOString();
const active = h => h.state.reminders.filter(r => r.reminderReq.groupId.startsWith('kchomo.refresh.'));
const first = (kind, date) => harness().schedule.refreshReminderTargets(kind, Date.parse(date))[0];

test('practice and monthly requests omit repeat fields', async () => {
  const h=harness();
  for(const kind of ['practice','senka','eo'])await h.service.setEnabled(kind,true);
  const requests=active(h).map(r=>r.reminderReq);
  assert.equal(requests.length,24);
  for(const request of requests) {
    assert.equal(Object.hasOwn(request,'daysOfWeek'),false);
  }
});

test('registration failures expose the native error code and reason and clear after a successful retry', async () => {
  const h=harness();
  h.state.publishFailure={code:401,message:'Wrong argument type:daysOfWeek. object expected.'};
  await h.service.setEnabled('eo',true);
  const status=()=>h.state.app.get(h.schedule.REFRESH_REMINDER_STATUS);
  assert.match(status(),/11 项登记失败.*提醒参数无效.*401.*daysOfWeek/);
  h.state.publishFailure={code:1700002,message:'The number of reminders exceeds the limit.'};
  await h.service.sync();assert.match(status(),/数量已达上限.*1700002/);
  h.state.publishFailure=null;await h.service.sync();
  assert.equal(active(h).length,11);assert.doesNotMatch(status(),/失败|401|1700002/);
});

test('practice targets stay within today in Beijing time and retain due reminders until refresh', () => {
  const h = harness();
  const rows = h.schedule.refreshReminderTargets('practice', Date.parse('2026-09-17T01:00:00+08:00'));
  assert.deepEqual(Array.from(rows, r => iso(r.remindAt)), ['2026-09-16T17:45:00.000Z', '2026-09-17T05:45:00.000Z']);
  for (const r of rows) assert.equal(r.deadline - r.remindAt, 15 * 60000);
  const next = first('practice', '2026-09-17T01:45:00+08:00');
  assert.equal(iso(next.remindAt), '2026-09-16T17:45:00.000Z');
  assert.equal(iso(first('practice','2026-09-17T02:00:00+08:00').remindAt),'2026-09-17T05:45:00.000Z');
  for(const time of ['14:00:00','23:30:00','23:59:59']) {
    assert.equal(h.schedule.refreshReminderTargets('practice',Date.parse(`2026-09-17T${time}+08:00`)).length,0);
  }
  assert.equal(iso(first('practice','2026-09-18T00:00:00+08:00').remindAt),'2026-09-17T17:45:00.000Z');
});

test('practice registers only remaining times today and waits until the next day to refill', async () => {
  const h=harness();
  h.state.now=Date.parse('2026-09-17T10:00:00+08:00');
  await h.service.setEnabled('practice',true);
  assert.equal(active(h).length,1);
  assert.equal(h.state.published.length,1);
  const due=active(h)[0];
  h.state.now=Date.parse('2026-09-17T13:45:00+08:00');
  await h.service.sync();
  assert.equal(active(h)[0].reminderId,due.reminderId);
  h.state.reminders=[]; // A dismissed reminder must not be recreated.
  await h.service.sync();
  assert.equal(h.state.published.length,1);
  h.state.now=Date.parse('2026-09-17T23:30:00+08:00');
  await h.service.sync();
  assert.equal(active(h).length,0);
  assert.match(h.state.app.get(h.schedule.REFRESH_REMINDER_STATUS),/今日.*已过/);
  assert.equal(h.state.prefs.get(h.schedule.refreshReminderKey('practice')),true);
  h.state.now=Date.parse('2026-09-18T00:00:00+08:00');
  await h.service.sync();
  assert.equal(active(h).length,2);
  assert.equal(h.state.published.length,3);
  await harness(h.state).service.sync();
  assert.equal(h.state.published.length,3);
});

test('old daily series and future practice events are replaced without touching other reminders', async () => {
  const h=harness();
  await h.service.setEnabled('eo',true);
  const monthlyIds=active(h).map(r=>r.reminderId);
  const future=h.schedule.refreshReminderTargets('practice',h.state.now+86400000)[0];
  h.state.reminders.push(
    {reminderId:991,reminderReq:{groupId:'kchomo.refresh.v1.practice.4000.1.45.-480',daysOfWeek:[1,2,3,4,5,6,7]}},
    {reminderId:-992,reminderReq:{groupId:future.groupId}},
    {reminderId:993,reminderReq:{groupId:'kchomo.expedition.2'}});
  await h.service.setEnabled('practice',true);
  assert.ok(h.state.cancelled.includes(991));
  assert.ok(h.state.cancelled.includes(-992));
  assert.ok(monthlyIds.every(id=>!h.state.cancelled.includes(id)));
  assert.ok(!h.state.cancelled.includes(993));
  assert.equal(active(h).filter(r=>r.reminderReq.groupId.includes('.practice.')).length,2);
});

test('enabling practice after both lead times never creates a late or next-day reminder', async () => {
  const h=harness();h.state.now=Date.parse('2026-09-17T13:46:00+08:00');
  await h.service.setEnabled('practice',true);
  assert.equal(h.state.published.length,0);
});

test('monthly deadlines handle 28/29/30/31-day months and year rollover', () => {
  for (const [month, end] of [['2026-02',28],['2028-02',29],['2026-04',30],['2026-12',31]]) {
    const senka = first('senka', `${month}-01T00:00:00+09:00`);
    const eo = first('eo', `${month}-01T00:00:00+09:00`);
    assert.equal(iso(senka.remindAt), `${month}-${end}T12:30:00.000Z`);
    assert.equal(iso(eo.remindAt), `${month}-${end}T12:00:00.000Z`);
    assert.equal(senka.deadline - senka.remindAt, 30 * 60000);
    assert.equal(eo.deadline - eo.remindAt, 3 * 3600000);
  }
  assert.equal(iso(first('eo','2027-01-01T00:00:00+09:00').remindAt), '2027-01-31T12:00:00.000Z');
});

test('deadline timestamps are independent of device timezone, including DST zones', () => {
  const old = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York']) {
      process.env.TZ = zone;
      const row = first('senka', '2026-09-17T00:00:00Z');
      assert.equal(iso(row.remindAt), '2026-09-30T12:30:00.000Z');
      const local = new Date(row.remindAt);
      assert.equal(new Date(local.getFullYear(),local.getMonth(),local.getDate(),local.getHours(),local.getMinutes()).getTime(),row.remindAt);
    }
  } finally {
    if (old === undefined) delete process.env.TZ; else process.env.TZ = old;
  }
});

test('defaults are off and leave expedition reminders and their slots alone', async () => {
  const h = harness();
  h.state.reminders.push({reminderId:999,reminderReq:{groupId:'kchomo.expedition.2'}});
  await h.service.start();
  assert.equal(h.state.published.length,0);
  assert.equal(h.state.cancelled.length,0);
  assert.equal(h.state.slots.length,0);
  for (const kind of ['practice','senka','eo']) assert.equal(h.state.app.get(h.schedule.refreshReminderKey(kind)),false);
  h.service.stop();
  assert.equal(h.state.timers.size,0);
});

test('all reminders fit alongside expeditions and both supply stages and survive process restart', async () => {
  const h = harness();
  for (const id of [997,998,999]) h.state.reminders.push({reminderId:id,reminderReq:{groupId:`kchomo.expedition.${id}`}});
  for (const id of [995,996]) h.state.reminders.push({reminderId:id,reminderReq:{groupId:`kchomo.harbor.supply.${id}`}});
  for (const kind of ['practice','senka','eo']) await h.service.setEnabled(kind,true);
  assert.equal(active(h).length,24);
  assert.equal(h.state.reminders.length,29);
  assert.equal(new Set(active(h).map(r=>r.reminderReq.notificationId)).size,24);
  assert.equal(h.state.slots.length,0,'calendar reminders do not change app notification slots');
  for (const {reminderReq:r} of active(h)) {
    assert.equal(r.slotType,3);
    assert.equal(r.ringDuration,0);
    assert.equal(r.snoozeTimes,0);
    assert.equal(r.maxScreenWantAgent,undefined);
    assert.equal(r.daysOfWeek,undefined);
  }
  await h.service.sync();
  assert.equal(h.state.published.length,24);
  h.service.stop();
  const restarted=harness(h.state);
  await restarted.service.start();
  assert.equal(restarted.state.published.length,24);
  assert.equal(restarted.state.app.get('alerts.refresh.eo.enabled'),true);
  restarted.service.stop();
});

test('disabling a kind cancels only its own reminders and persists across restart', async () => {
  const h=harness();
  await h.service.setEnabled('practice',true);
  await h.service.setEnabled('eo',true);
  await h.service.setEnabled('practice',false);
  assert.equal(active(h).length,11);
  assert.ok(active(h).every(r=>r.reminderReq.groupId.includes('.eo.')));
  await harness(h.state).service.sync();
  assert.equal(h.state.published.length,13);
  await h.service.setEnabled('eo',false);
  assert.equal(active(h).length,0);
});

test('due monthly reminders stay registered until deadline and dismissed ones are not recreated', async () => {
  const h=harness();
  await h.service.setEnabled('eo',true);
  h.state.now=Date.parse('2026-09-30T20:00:00+08:00');
  await h.service.sync();
  assert.equal(h.state.cancelled.length,0);
  assert.equal(h.state.published.length,11);
  const due=active(h)[0];
  h.state.reminders=h.state.reminders.filter(r=>r!==due);
  await h.service.sync();
  assert.equal(h.state.published.length,11);
  h.state.now=Date.parse('2026-09-30T23:00:00+08:00');
  await h.service.sync();
  assert.equal(h.state.published.length,12);
  assert.equal(active(h).length,11);
});

test('enabling after a monthly lead time does not send a late reminder', async () => {
  const h=harness();
  h.state.now=Date.parse('2026-09-30T20:40:00+08:00');
  await h.service.setEnabled('senka',true);
  assert.equal(active(h).length,10);
  assert.ok(active(h).every(r=>r.reminderReq.dateTime.month!==9));
});

test('permission denial and publish failure retry without duplicate reminders', async () => {
  const h=harness(); h.state.permission=false;
  await h.service.setEnabled('practice',true);
  assert.equal(h.state.published.length,0);
  assert.match(h.state.app.get('alerts.refresh.status'),/日历未授权/);
  h.state.permission=true; h.state.failPublish=true;
  await h.service.sync();
  assert.match(h.state.app.get('alerts.refresh.status'),/失败/);
  h.state.failPublish=false;
  await h.service.sync(); await h.service.sync();
  assert.equal(h.state.published.length,2);
});

test('failed cancellation retries after disable; rapid changes keep the final persisted setting', async () => {
  const h=harness();
  await h.service.setEnabled('practice',true);
  h.state.failCancel=true;
  await assert.rejects(h.service.setEnabled('practice',false));
  assert.equal(h.state.prefs.get('alerts.refresh.practice.enabled'),false);
  h.state.failCancel=false;
  await h.service.sync();
  assert.equal(active(h).length,0);
  await Promise.all([h.service.setEnabled('practice',true),h.service.setEnabled('practice',false)]);
  assert.equal(active(h).length,0);
});

test('a failed preference write never changes the running setting and does not block later operations', async () => {
  const h=harness(); h.state.failSave=true;
  await assert.rejects(h.service.setEnabled('practice',true));
  assert.equal(h.state.prefs.has('alerts.refresh.practice.enabled'),false);
  assert.equal(active(h).length,0);
  h.state.failSave=false;
  await h.service.setEnabled('practice',true);
  assert.equal(active(h).length,2);
});
