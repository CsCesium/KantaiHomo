// node scripts/test-calendar-reminders.cjs [path/to/typescript]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const ts=require(process.argv[2]||'typescript');
const source=path.resolve(__dirname,'../entry/src/main/ets/features/alerts/module/calendarReminder.ets');
function harness(shared) {
  const state=shared||{now:Date.parse('2026-09-20T10:00:00+08:00'),granted:true,grantOnRequest:true,
    events:[],calendars:[],native:[],nativeCancelled:[],nextId:0,created:0,app:new Map(),permissionRequests:0};
  const manager={
    getAllCalendars:async()=>state.calendars,
    createCalendar:async account=>{
      state.created++;
      const config={enableReminder:false};
      const calendar={getAccount:()=>account,getConfig:()=>config,setConfig:async c=>Object.assign(config,c),
        getEvents:async function(filter,keys) {
          // Mirror the real bridge: explicitly passing undefined is NOT an omitted optional argument.
          if(arguments.length && (!filter||typeof filter!=='object'))throw {code:401,message:'type error!'};
          return state.events.filter(e=>!filter||filter.ids.includes(e.id)).map(e=>{
            const copy=structuredClone(e);
            // The default query does not include recurrenceRule.
            if(!keys)delete copy.recurrenceRule;
            return copy;
          });
        },
        addEvent:async e=>{assert.equal(state.granted,true);const id=state.nextId++;state.events.push({...structuredClone(e),id});return id;},
        deleteEvent:async id=>{if(state.failDelete)throw new Error('delete failed');state.events=state.events.filter(e=>e.id!==id);},
      };
      state.calendars.push(calendar);return calendar;
    },
  };
  const adapters={
    '@kit.CalendarKit':{calendarManager:{getCalendarManager:()=>manager,CalendarType:{LOCAL:'local'},EventType:{NORMAL:0},
      RecurrenceFrequency:{DAILY:3},EventFilter:{filterById:ids=>({ids})}}},
    '@kit.AbilityKit':{abilityAccessCtrl:{GrantStatus:{PERMISSION_GRANTED:0},createAtManager:()=>({
      checkAccessToken:async()=>state.granted?0:-1,
      requestPermissionsFromUser:async()=>{state.permissionRequests++;state.granted=state.grantOnRequest;},
    })}},
    '@kit.BackgroundTasksKit':{reminderAgentManager:{ReminderType:{REMINDER_TYPE_CALENDAR:1},
      getAllValidReminders:async()=>{if(state.nativeError)throw {code:state.nativeError};return state.native.slice();},
      cancelReminder:async id=>{state.nativeCancelled.push(id);state.native=state.native.filter(r=>r.reminderId!==id);},
      publishReminder:async()=>{throw new Error('zero-quota agent backend must never be used');},
    }},
    '../../../infra/appContext':{getAppContext:()=>({applicationInfo:{accessTokenId:1}})},
  };
  class Clock extends Date {static now(){return state.now;}}
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(source,'utf8'),{
    fileName:'calendarReminder.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText,{exports,Date:Clock,console:{info(){},warn(){}},AppStorage:{setOrCreate:(k,v)=>state.app.set(k,v)},
    require:spec=>{assert.ok(adapters[spec],spec);return adapters[spec];}});
  return {state,service:exports.calendarReminder,status:()=>state.app.get(exports.CALENDAR_REMINDER_STATUS)};
}
function request(group='kchomo.expedition.2.5.123',daily=false) {
  const r={reminderType:1,groupId:group,notificationId:1002,title:'远征归来',content:'第2舰队归来',
    dateTime:{year:2026,month:9,day:20,hour:11,minute:0,second:15}};
  if(daily)r.daysOfWeek=[1,2,3,4,5,6,7];return r;
}

test('calendar queries omit optional arguments and reminders recover after restart without duplicate events',async()=>{
  const h=harness();await h.service.requestPermission();
  const ids=await Promise.all([h.service.publishReminder(request()),h.service.publishReminder(request())]);
  assert.deepEqual(ids,[-1,-1]);assert.equal(h.state.created,1);assert.equal(h.state.events.length,1);
  const restarted=harness(h.state);const rows=await restarted.service.getAllValidReminders();
  assert.equal(rows.length,1);assert.equal(rows[0].reminderReq.groupId,request().groupId);
  assert.equal(rows[0].reminderReq.content,request().content);
  await restarted.service.publishReminder(request());assert.equal(h.state.events.length,1);
  assert.deepEqual(h.state.events[0].reminderTime,[0]);
  assert.equal(h.state.events[0].startTime,new Date(2026,8,20,11,0,15).getTime());
});

test('legacy daily series remain readable; new practice, monthly and harbor events are one-shot',async()=>{
  const h=harness();
  await h.service.publishReminder(request('kchomo.refresh.v1.practice.4000',true));
  await h.service.publishReminder(request('kchomo.refresh.v1.eo.123'));
  await h.service.publishReminder(request('kchomo.harbor.101.supply.123'));
  await h.service.publishReminder(request('kchomo.harbor.101.supply.123.30'));
  await h.service.publishReminder(request('kchomo.refresh.v1.practice.1790000000000.-480'));
  assert.equal(h.state.events[0].recurrenceRule.recurrenceFrequency,3);
  assert.ok(h.state.events.slice(1).every(e=>!Object.hasOwn(e,'recurrenceRule')));
  const rows=await h.service.getAllValidReminders();
  assert.equal(rows.length,5);
  assert.equal(Object.hasOwn(rows[4].reminderReq,'daysOfWeek'),false);
  await h.service.cancelReminder(rows[0].reminderId);
  assert.equal(h.state.events.length,4);
  assert.ok(h.state.events.every(e=>!Object.hasOwn(e,'recurrenceRule')));
});

test('denied permission never creates events or prompts during background synchronization',async()=>{
  const h=harness();h.state.granted=false;h.state.grantOnRequest=false;
  await h.service.getAllValidReminders();assert.equal(h.state.permissionRequests,0);
  await assert.rejects(h.service.publishReminder(request()),/授权日历/);
  assert.equal(await h.service.requestPermission(),false);assert.equal(h.state.permissionRequests,1);
  assert.equal(h.state.created,0);assert.equal(h.state.events.length,0);
});

test('cancellation is scoped to owned events and keeps unrelated calendar data',async()=>{
  const h=harness();const id=await h.service.publishReminder(request());
  h.state.events.push({id:99,title:'私人日程',identifier:'personal'});
  await h.service.cancelReminder(-100);assert.equal(h.state.events.length,2);
  await h.service.cancelReminder(id);assert.equal(h.state.events.length,1);assert.equal(h.state.events[0].id,99);
  await h.service.cancelReminder(id);assert.equal(h.state.events.length,1);
});

test('old agent reminders retain ownership and are cancelled through their original backend',async()=>{
  const h=harness();h.state.native=[{reminderId:12,reminderReq:request()}];
  assert.equal((await h.service.getAllValidReminders())[0].reminderId,12);
  await h.service.cancelReminder(12);assert.deepEqual(h.state.nativeCancelled,[12]);
  h.state.nativeError=201;await h.service.publishReminder(request());
  assert.equal((await h.service.getAllValidReminders()).length,1);
});

test('failed cancellation retains the event for retry; disabled calendar is not silently re-enabled',async()=>{
  const h=harness();const id=await h.service.publishReminder(request());h.state.failDelete=true;
  await assert.rejects(h.service.cancelReminder(id),/delete failed/);assert.equal(h.state.events.length,1);
  h.state.failDelete=false;await h.service.cancelReminder(id);assert.equal(h.state.events.length,0);
  await h.state.calendars[0].setConfig({enableReminder:false});
  await assert.rejects(h.service.publishReminder(request()),/开启/);
  await assert.rejects(h.service.getAllValidReminders(),/已关闭/);
  await h.service.requestPermission();await h.service.publishReminder(request());assert.equal(h.state.events.length,1);
});
