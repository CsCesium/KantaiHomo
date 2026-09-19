// node scripts/test-harbor-mvp.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');
function compile(relative, context = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relative),'utf8'), {
    fileName: relative.replace(/\.ets$/,'.ts'),
    compilerOptions: { target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(output, { exports, ...context });
  return exports;
}
const logic = compile('features/alerts/module/harborTimer.ts');
const mvp = compile('features/panel/battleMvp.ts');
const ship = (uid,name,extra={}) => ({ uid,masterId:uid,name,hpNow:10,hpMax:10,cond:49,fuel:10,ammo:10,fuelMax:10,ammoMax:10,slots:[],...extra });
function game() {
  return { admiral:{memberId:101},materials:{fuel:100,steel:100},Ndocks:[],slotItemIndex:new Map(),
    decks:[{deckId:1,shipUids:[1,2],expeditionReturnTime:null},{deckId:2,shipUids:[3,4],expeditionReturnTime:null}],
    ships:new Map([[1,ship(1,'明石改')],[2,ship(2,'吹雪',{hpNow:8})],[3,ship(3,'野埼改')],[4,ship(4,'白雪')]]) };
}

test('MVP resolves main and escort positions to snapshot ship names without using current formation',()=>{
  const result={mvp:2,mvpCombined:1,friendMain:{ships:[{uid:1,name:'吹雪'},{uid:2,name:'明石改'}]},friendEscort:{ships:[{uid:3,name:'白雪'}]}};
  assert.equal(mvp.battleMvpLabel(result),'明石改 / 白雪');
  assert.deepEqual(Array.from(mvp.battleMvpShips(result),s=>s.uid),[2,3]);
  assert.equal(mvp.battleMvpLabel({...result,mvp:0,mvpCombined:99}),'');
  assert.equal(mvp.battleMvpLabel({...result,isAirRaid:true}),'');
  assert.equal(mvp.battleMvpShips(null).length,0);
});

test('preview colors prioritize MVP gold over taiha red, including taiha without sinking risk',()=>{
  const source=fs.readFileSync(path.join(root,'app/pages/components/panel/battle/BattlePreviewPanel.ets'),'utf8');
  const parsed=ts.createSourceFile('panel.ts',source,ts.ScriptTarget.Latest,true);
  const fn=parsed.statements.find(node=>ts.isFunctionDeclaration(node) && node.name.text==='shipNameColor');
  const context={PanelColors:{hpCrit:'red',txtPrimary:'white',txtMuted:'muted',escapeHp:'gray',hpSinkRisk:'risk'},isShipEscaped:uid=>uid===3};
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(fn.getText(parsed),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
  assert.equal(context.shipNameColor({uid:1,isTaiha:true},true),'#FFD700');
  assert.equal(context.shipNameColor({uid:1,isTaiha:true,hasSinkRisk:false}),'red');
  assert.equal(context.shipNameColor({uid:3},false),'gray');
  assert.equal(context.shipNameColor({uid:1,isSunk:true},false),'muted');
});

test('eligibility requires flagship, repairable recipients and repair facility reach',()=>{
  const state=game();
  assert.equal(logic.eligibleHarborFleets(state,[]).length,2);
  state.ships.get(2).hpNow=10;
  state.decks[0].shipUids.push(5);
  state.ships.set(5,ship(5,'初雪',{hpNow:8}));
  assert.equal(logic.eligibleHarborFleets(state,[]).length,1);
  state.ships.get(1).slots=[100];state.slotItemIndex.set(100,86);
  assert.equal(logic.eligibleHarborFleets(state,[]).length,2);
  state.ships.get(5).hpNow=5;
  assert.equal(logic.eligibleHarborFleets(state,[]).length,1);
  state.decks[0].shipUids=[2,1,5];
  assert.equal(logic.eligibleHarborFleets(state,[]).length,1);
});

test('Nosaki supply, damage, morale, dock, expedition and sortie conditions suppress invalid reminders',()=>{
  const base=game();
  const eligible=()=>logic.eligibleHarborFleets(base,[]).some(f=>f.kind==='supply');
  const flag=base.ships.get(3);
  for(const [field,bad,good] of [['fuel',9,10],['ammo',9,10],['cond',29,49],['hpNow',7,10]]) {
    flag[field]=bad; assert.equal(eligible(),false);flag[field]=good;
  }
  base.Ndocks=[{state:1,shipUid:3}];assert.equal(eligible(),false);
  base.Ndocks=[{state:1,shipUid:4}];assert.equal(eligible(),false);base.Ndocks=[];
  base.ships.get(4).cond=54;assert.equal(eligible(),false);base.ships.get(4).cond=49;
  base.decks[1].expeditionReturnTime=1;assert.equal(eligible(),false);base.decks[1].expeditionReturnTime=null;
  assert.equal(logic.eligibleHarborFleets(base,[2]).some(f=>f.kind==='supply'),false);
  flag.name='南海';assert.equal(eligible(),false);
});

test('shared clocks keep elapsed time on early port visits and reset only due cycles',()=>{
  const timer=new logic.HarborTimer(); const start=1000;
  timer.observe(['repair','supply'],start);
  const fleets=[{kind:'repair',deckId:1},{kind:'repair',deckId:2},{kind:'supply',deckId:3}];
  timer.port(fleets,start+10*60000);
  assert.equal(timer.clock('repair').startedAt,start);
  timer.port(fleets,start+15*60000);
  assert.equal(timer.clock('repair').startedAt,start);
  assert.equal(timer.clock('supply').startedAt,start+15*60000);
  const repair=timer.views(fleets).filter(v=>v.kind==='repair');
  assert.equal(repair[0].dueAt,repair[1].dueAt);
  timer.port(fleets,start+20*60000);
  assert.equal(timer.clock('repair').startedAt,start+20*60000);
  const restored=new logic.HarborTimer();restored.restore(timer.serialize(),start+21*60000);
  assert.equal(restored.clock('repair').startedAt,start+20*60000);
});

function harness(storage=new Map()) {
  const state={game:game(),now:Date.parse('2026-09-18T12:00:00+08:00'),sortie:null,permission:true,
    reminders:[],published:[],cancelled:[],toasts:[],notifications:[],app:new Map(),storage,timers:new Map(),nextId:1,nextTimer:1,failPublish:false};
  class Clock extends Date {static now(){return state.now;}}
  const adapters={
    '@ohos.notificationManager':{default:{SlotType:{CONTENT_INFORMATION:3},ContentType:{NOTIFICATION_CONTENT_BASIC_TEXT:0},
      isNotificationEnabled:async()=>state.permission,publish:async r=>state.notifications.push(r)}},
    '@ohos.promptAction':{default:{showToast:r=>state.toasts.push(r)}},
    '@kit.BackgroundTasksKit':{reminderAgentManager:{ReminderType:{REMINDER_TYPE_CALENDAR:1},
      addNotificationSlot:async slot=>assert.equal(slot.vibrationEnabled,false),
      getAllValidReminders:async()=>state.reminders.slice(),
      cancelReminder:async id=>{state.cancelled.push(id);state.reminders=state.reminders.filter(r=>r.reminderId!==id);},
      publishReminder:async reminderReq=>{
        if(state.failPublish)throw new Error('failed');
        state.published.push(reminderReq);state.reminders.push({reminderId:state.nextId++,reminderReq});return state.nextId-1;
      }}},
    '../../state':{getGameState:()=>({getState:()=>state.game})},
    '../bus':{getAlertBus:()=>({getConfig:()=>({enableToast:true})})},
    '../../../infra/storage/kv':{kvGetBool:async(k,d)=>storage.get(k)??d,kvGetString:async(k,d)=>storage.get(k)??d,kvSet:async(k,v)=>storage.set(k,v)},
    '../../utils/common':{parseSvdata:JSON.parse,parseFormBody:body=>({getInt:(key,fallback)=>{
      const p=new URLSearchParams(body);return p.has(key)?Number(p.get(key)):fallback;
    }})},
    '../../../domain/service/sortie':{getSortieContext:()=>state.sortie},
    './harborTimer':logic,
    './expeditionTime':{formatExpeditionReturnTime:time=>new Date(time).toISOString().slice(11,19)},
  };
  const mod=compile('features/alerts/module/harborReminder.ets',{
    Date:Clock,console:{warn(){}},AppStorage:{setOrCreate:(k,v)=>state.app.set(k,v)},
    setTimeout:cb=>{const id=state.nextTimer++;state.timers.set(id,cb);return id;},clearTimeout:id=>state.timers.delete(id),
    require:spec=>{assert.ok(adapters[spec],`unexpected dependency (including vibrator): ${spec}`);return adapters[spec];},
  });
  const service=mod.getHarborReminderService();
  return {state,service,api:async(endpoint='/api_port/port',body='',result=1,before=mod.harborFlagships())=>{
    await service.afterApi({url:endpoint,requestBody:body,responseText:JSON.stringify({api_result:result})},before);
  }};
}

test('service registers repair plus two supply stages and emits each toast only once',async()=>{
  const h=harness();await h.service.start();assert.equal(h.state.reminders.length,0);
  await h.api();assert.equal(h.state.reminders.length,3);
  assert.match(h.service.notification().title,/给粮/);
  for(const r of h.state.published){assert.equal(r.ringDuration,0);assert.equal(r.slotType,3);}
  h.state.now+=15*60000;await h.service.sync();await h.service.sync();
  assert.equal(h.state.toasts.length,1);assert.equal(h.state.notifications.length,0);
  assert.match(h.service.notification().title,/维修/);
  h.state.now+=5*60000;await h.service.sync();assert.equal(h.state.toasts.length,2);
  await h.service.sync();assert.equal(h.state.toasts.length,2);
  h.state.now+=10*60000;await h.service.sync();assert.equal(h.state.toasts.length,3);
  assert.match(h.state.toasts.at(-1).message,/30 分钟/);
  h.state.now+=30*60000;await h.service.sync();assert.equal(h.state.toasts.length,3);
  h.service.stop();assert.equal(h.state.timers.size,0);assert.equal(h.state.reminders.length,3);
});

test('formation change restarts the relevant shared timer but presets, failed requests and early ports do not',async()=>{
  const h=harness();await h.api();const initial=h.state.published[0].groupId;
  h.state.now+=60000;await h.api('/api_req_hensei/change','api_id=1&api_ship_id=2',0);
  await h.api('/api_req_hensei/preset_select','api_id=1');await h.api();
  assert.equal(h.state.published.length,3);
  await h.api('/api_req_hensei/change','api_id=1&api_ship_id=2');
  assert.equal(h.state.published.length,4);assert.notEqual(h.state.published[3].groupId,initial);
  assert.equal(h.state.cancelled.length,1);
});

test('disable cancels only harbor timers; persisted clocks and toast markers survive restart',async()=>{
  const h=harness();await h.api();h.state.now+=15*60000;await h.service.sync();
  const saved=h.state.storage.get('alerts.harbor.clock.101');assert.ok(JSON.parse(saved).find(c=>c.kind==='supply').toastShown);
  h.state.reminders.push({reminderId:999,reminderReq:{groupId:'kchomo.expedition.2'}});
  await h.service.setEnabled(false);assert.equal(h.service.notification(),null);
  assert.equal(h.state.reminders.length,1);assert.equal(h.state.reminders[0].reminderId,999);
  const restarted=harness(h.state.storage);await restarted.service.start();await restarted.api();
  assert.equal(restarted.service.notification(),null);assert.equal(restarted.state.published.length,0);
  restarted.service.stop();
});

test('sortie removes active timer notifications and return-to-port starts the next due cycle',async()=>{
  const h=harness();await h.api();h.state.sortie={deckId:1,combinedType:0};
  await h.api('/api_req_map/start');assert.equal(h.state.reminders.length,2);
  h.state.now+=20*60000;h.state.sortie=null;await h.api();
  assert.equal(h.state.reminders.length,3);assert.equal(h.state.toasts.length,0);
  const saved=JSON.parse(h.state.storage.get('alerts.harbor.clock.101'));
  assert.ok(saved.every(clock=>clock.startedAt===h.state.now));
});

test('registration failure falls back to a single system notification without vibration or repeated toast',async()=>{
  const h=harness();h.state.failPublish=true;await h.api();
  h.state.now+=15*60000;await h.service.sync();await h.service.sync();
  assert.equal(h.state.notifications.length,1);assert.equal(h.state.toasts.length,1);
});

test('switching accounts cancels previous account reminders and starts independent clocks',async()=>{
  const h=harness();await h.api();h.state.now+=60000;h.state.game.admiral.memberId=202;await h.api();
  assert.equal(h.state.reminders.length,3);
  assert.ok(h.state.reminders.every(r=>r.reminderReq.groupId.includes('.202.')));
  assert.ok(h.state.storage.has('alerts.harbor.clock.101'));assert.ok(h.state.storage.has('alerts.harbor.clock.202'));
});

test('background thresholds keep the system notification and defer the one-time toast until foreground',async()=>{
  const h=harness();await h.api();h.service.setForeground(false);await h.service.sync();
  h.state.now+=15*60000;await h.service.sync();
  assert.equal(h.state.toasts.length,0);assert.equal(h.state.reminders.length,3);
  h.service.setForeground(true);await h.service.sync();await h.service.sync();
  assert.equal(h.state.toasts.length,1);assert.equal(h.state.notifications.length,0);
});

test('supply switches its displayed target from 15 to 30 minutes without restarting or repeating after the cap',async()=>{
  const h=harness();h.state.game.ships.get(2).hpNow=10;await h.api();
  const start=h.state.now;
  assert.match(h.service.notification().title,/15分/);
  const times=h.state.published.map(r=>r.dateTime.minute);
  assert.deepEqual(times,[15,30]);
  h.state.now+=15*60000;await h.service.sync();
  assert.match(h.service.notification().title,/04:30:00.*30分/);
  assert.equal(h.state.toasts.length,1);
  h.state.now+=15*60000;await h.service.sync();
  assert.match(h.service.notification().title,/可回港.*30分/);
  assert.equal(h.state.toasts.length,2);
  h.state.now+=15*60000;await h.service.sync();
  assert.equal(h.state.toasts.length,2);assert.equal(h.state.published.length,2);
  const clock=JSON.parse(h.state.storage.get('alerts.harbor.clock.101')).find(c=>c.kind==='supply');
  assert.equal(clock.startedAt,start);assert.equal(clock.supplyFinal.toastShown,true);
});

test('late foreground sync sends only the latest supply toast and fallback notification',async()=>{
  const h=harness();h.state.game.ships.get(2).hpNow=10;h.state.failPublish=true;await h.api();
  h.service.setForeground(false);await h.service.sync();
  h.state.now+=31*60000;h.service.setForeground(true);await h.service.sync();await h.service.sync();
  assert.equal(h.state.toasts.length,1);assert.match(h.state.toasts[0].message,/30 分钟/);
  assert.equal(h.state.notifications.length,1);assert.equal(h.state.notifications[0].id,4302);
});

test('legacy clock upgrade preserves first-stage delivery and restores independent final-stage markers',()=>{
  const timer=new logic.HarborTimer();
  timer.restore(JSON.stringify([{kind:'supply',startedAt:1000,toastShown:true,systemScheduled:true,notificationSent:false}]),1000000);
  assert.equal(timer.clock('supply').toastShown,true);
  assert.equal(timer.clock('supply').supplyFinal.toastShown,false);
  timer.clock('supply').supplyFinal.toastShown=true;
  const restored=new logic.HarborTimer();restored.restore(timer.serialize(),1000000);
  assert.equal(restored.clock('supply').supplyFinal.toastShown,true);
});

test('supply formation reset replaces both stages; reaching morale 54 cancels them',async()=>{
  const h=harness();h.state.game.ships.get(2).hpNow=10;await h.api();
  const groups=h.state.published.map(r=>r.groupId);
  h.state.now+=16*60000;await h.api('/api_req_hensei/change','api_id=2&api_ship_id=4');
  assert.equal(h.state.cancelled.length,2);assert.equal(h.state.reminders.length,2);
  assert.ok(h.state.reminders.every(r=>!groups.includes(r.reminderReq.groupId)));
  h.state.game.ships.get(4).cond=54;await h.api();
  assert.equal(h.state.reminders.length,0);assert.equal(h.service.notification(),null);
});

test('two supply fleets share one native request per threshold',async()=>{
  const h=harness();h.state.game.ships.get(1).name='野埼改';await h.api();
  assert.equal(h.state.reminders.length,2);
  assert.ok(h.state.published.every(r=>r.content.startsWith('第1舰队、第2舰队已等待')));
});
