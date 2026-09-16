// Run pure quest logic against real bundled rule data; no game or device is required.
// Usage: node scripts/test-quest-tracking.cjs [path/to/typescript]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets/features/quests');
const cache = new Map();
function load(name) {
  const file = path.resolve(root, name + '.ts');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', code)(spec => load(spec), module, module.exports);
  return module.exports;
}
const { satisfiesQuestFormation } = load('formation');
const { QuestShipCatalog } = load('shipMetadata');
const { matchesQuestGoal } = load('goalMatcher');
const { QuestCounter, QuestPageAccumulator, questPeriod } = load('counter');
const { extractQuestEvents } = load('events');
const resources = path.resolve(__dirname, '../entry/src/main/resources/rawfile/data');
const formations = JSON.parse(fs.readFileSync(path.join(resources, 'quest_req.json'), 'utf8'));
const definitions = JSON.parse(fs.readFileSync(path.join(resources, 'quest_goals.json'), 'utf8')).quests;
const now = Date.parse('2026-09-15T23:00:00+08:00');
const ship = (name, stype, position, extra = {}) => ({ uid: position, masterId: position, name, stype,
  ctype: 1, level: 99, position, ancestors: [position], names: [name], ...extra });
const quest = (questId, state = 2, progress = 0, type = 2) => ({ questId, state, progress, type,
  title: `任务${questId}`, detail: '', category: 2, updatedAt: now, capturedAt: now });
const goal = extra => ({ key: 'battle', event: 'battle', required: 2, ...extra });
const context = (extra = {}) => ({ fleet: () => [], shipType: id => id, enemyType: id => id,
  equip: id => ({ id, type: 6 }), sortieDeckId: 1, ...extra });

test('formation checks flagship, ship type, count and unknown master data', () => {
  const fleet = [ship('川内', 3, 1), ship('吹雪', 2, 2), ship('白雪', 2, 3)];
  assert.ok(satisfiesQuestFormation(206, fleet, formations));
  assert.equal(satisfiesQuestFormation(206, fleet.map(s => ({ ...s, position: 4 - s.position })), formations), false);
  assert.equal(satisfiesQuestFormation(206, fleet.slice(0, 2), formations), false);
  assert.equal(satisfiesQuestFormation(206, [...fleet, ship('', 0, 4)], formations), false);
  assert.equal(satisfiesQuestFormation(999999, fleet, formations), false);
});
test('duplicate quest IDs are alternatives; upper bounds and exact counts are enforced', () => {
  const fleet = [ship('鳳翔', 7, 1), ship('龍驤', 7, 2), ship('川内', 3, 3),
    ship('吹雪', 2, 4), ship('白雪', 2, 5), ship('初雪', 2, 6)];
  assert.ok(satisfiesQuestFormation(254, fleet, formations));
  assert.equal(satisfiesQuestFormation(254, fleet.slice(0, 5), formations), false);
  const seventh = ship('長門', 9, 7);
  assert.equal(satisfiesQuestFormation(222, [ship('暁', 2, 1),ship('響', 2, 2),ship('雷', 2, 3),ship('電', 2, 4), seventh], formations), false);
});
test('ship names match remodel ancestors, not arbitrary substrings, and duplicate copies do not fill named groups', () => {
  const catalog = new QuestShipCatalog();
  catalog.setMasters([
    { id: 1, name: '響', stype: 2, ctype: 1, afterShipId: 2 },
    { id: 2, name: '響改', stype: 2, ctype: 1, afterShipId: 3 },
    { id: 3, name: 'Верный', stype: 2, ctype: 1, afterShipId: null },
  ]);
  const fleet = [ship('暁', 2, 1), catalog.ship(10, 3, 70, 2), ship('雷', 2, 3), ship('電', 2, 4)];
  assert.ok(satisfiesQuestFormation(222, fleet, formations));
  const req = [{ ID: 1, 要求: [{ 舰: ['潮'], 大于等于: 1 }] }];
  assert.equal(satisfiesQuestFormation(1, [ship('満潮', 2, 1)], req), false);
  assert.equal(satisfiesQuestFormation(222, [fleet[0], fleet[0], fleet[2], fleet[3]], formations), false);
});
test('formation level, class and nationality use the same selector union', () => {
  const req = [{ ID: 1, 要求: [{ 舰: ['Nelson'], 舰型: [82], 国籍: ['美'], 等级: 70, 大于等于: 3 }] }];
  const fleet = [ship('Nelson', 9, 1), ship('Jervis', 2, 2, {ctype:82}),ship('Iowa', 9, 3,{nation:'美'})];
  assert.ok(satisfiesQuestFormation(1, fleet, req));
  fleet[2].level = 69;
  assert.equal(satisfiesQuestFormation(1, fleet, req), false);
});
test('poi goals enforce map, rank event, remodel IDs, flagship, secondary position and escort AND/OR', () => {
  const fleet = [ship('旗艦', 3, 1, {ancestors:[1,100]}),ship('駆逐', 2, 2,{ancestors:[2,200]}),ship('駆逐2', 2, 3)];
  const g = goal({ event:'battle_boss_win_rank_s', maparea:[25], flagshipId:[100], secondshipId:[200],
    escortshipId:[[[999],1],[[200],1]], escortshiptype:[[[2],2]], escortshipIdAll:[[[100],1],[[200],1]] });
  const event = {event:g.event,delta:1,maparea:25,fleet};
  assert.ok(matchesQuestGoal(g,event));
  assert.equal(matchesQuestGoal(g,{...event,maparea:24}),false);
  assert.equal(matchesQuestGoal(g,{...event,event:'battle_boss_win'}),false);
  assert.equal(matchesQuestGoal({...g,escortshipIdAll:[[[999],1]]},event),false);
  assert.equal(matchesQuestGoal({...g,escortshipId:[[[100],1,true]]},event),false);
});
test('counting starts only for accepted quests, pauses on stop and resumes without losing progress', () => {
  const counter = new QuestCounter(definitions);
  counter.sync([quest(210,1)],now);
  counter.apply([{event:'battle',delta:1}],now);
  assert.equal(counter.progress(210).label,'≈0/10');
  counter.changeState(210,2,now); counter.apply([{event:'battle',delta:2}],now);
  assert.equal(counter.progress(210).label,'≈2/10');
  counter.changeState(210,1,now); counter.apply([{event:'battle',delta:2}],now);
  counter.changeState(210,2,now); counter.apply([{event:'battle',delta:1}],now);
  assert.equal(counter.progress(210).label,'≈3/10');
  counter.claim(210); assert.equal(counter.progress(210),null);
});
test('server bands correct single-goal estimates; completion is authoritative and restores across restart', () => {
  const counter = new QuestCounter(definitions);
  counter.sync([quest(210,2,1)],now); assert.equal(counter.progress(210).label,'≈5/10');
  counter.apply([{event:'battle',delta:10}],now);
  counter.sync([quest(210,2,2)],now); assert.equal(counter.progress(210).label,'≈9/10');
  const restarted = new QuestCounter(definitions); restarted.restore(counter.serialize(),now);
  assert.equal(restarted.progress(210).label,'≈9/10');
  restarted.sync([quest(210,3,2)],now); assert.equal(restarted.progress(210).label,'10/10');
});
test('multi-goal counters progress independently and do not fabricate allocation from a 50% flag', () => {
  const counter = new QuestCounter(definitions);
  counter.sync([quest(214,2,1,3)],now);
  counter.apply([{event:'sally',delta:1},{event:'battle_boss',delta:1},{event:'battle_rank_s',delta:1}],now);
  assert.equal(counter.progress(214).label,'≈3/78');
  assert.match(counter.progress(214).detail,/出擊：≈1\/36/);
});
test('reset boundaries use JST 05:00 for daily, Monday, month, quarter and yearly quests', () => {
  const before = Date.parse('2026-09-01T03:59:59+08:00');
  const after = before + 1000;
  for(const type of [1,3,4,109]) assert.notEqual(questPeriod(type,before),questPeriod(type,after));
  assert.equal(questPeriod(2,before),questPeriod(2,after));
  const monday = Date.parse('2026-09-14T04:00:00+08:00');
  assert.notEqual(questPeriod(2,monday-1),questPeriod(2,monday));
  const counter = new QuestCounter(definitions);
  counter.sync([quest(210)],now); counter.apply([{event:'battle',delta:2}],now);
  counter.apply([{event:'battle',delta:1}],now+86400000);
  assert.equal(counter.progress(210),null);
});
test('resetInterval can reset a subcounter without cancelling its weekly quest', () => {
  const counter = new QuestCounter([{id:1,type:2,resetInterval:1,goals:[goal({required:3})]}]);
  counter.sync([quest(1)],now); counter.apply([{event:'battle',delta:2}],now);
  counter.apply([{event:'battle',delta:1}],now+86400000);
  assert.equal(counter.progress(1).label,'≈1/3');
  assert.equal(counter.quests()[0].state,2);
});
test('pagination merges partial pages and replaces only a complete consistent unfiltered list', () => {
  const pages = new QuestPageAccumulator();
  const page = {count:2,pageCount:2,page:1,tabId:0};
  assert.equal(pages.collect(page,[quest(201)]),null);
  assert.deepEqual(pages.collect({...page,page:2},[quest(210)]).map(q=>q.questId),[201,210]);
  assert.equal(pages.collect({...page,tabId:2,pageCount:1,count:1},[quest(201)]),null);
  pages.collect(page,[quest(201)]);
  assert.equal(pages.collect({...page,page:2,count:3},[quest(210)]),null);
  assert.deepEqual(pages.collect({...page,pageCount:0,count:0},[]),[]);
});
test('practice and actual sortie battle events stay separate and boss rank thresholds are correct', () => {
  const battle = {key:'a',fleet:[],maparea:25,mapcell:10,boss:true,enemies:[{masterId:15,hp:0},{masterId:13,hp:1}]};
  const ctx = context({battle});
  const practice = extractQuestEvents('/api_req_practice/battle_result',{api_win_rank:'S'},new Map(),ctx);
  assert.deepEqual(practice.map(e=>e.event),['practice','practice_win','practice_win_a','practice_win_s']);
  const sortie = extractQuestEvents('/api_req_sortie/battleresult',{api_win_rank:'A'},new Map(),ctx);
  assert.ok(sortie.some(e=>e.event==='battle_boss_win_rank_a'));
  assert.equal(sortie.some(e=>e.event==='battle_boss_win_rank_s'),false);
  assert.equal(sortie.filter(e=>e.event==='sinking').length,1);
});
test('equipment disposal counts matching equipment once and counts the operation separately', () => {
  const counter = new QuestCounter(definitions);
  counter.sync([quest(613,2,0,3),quest(678,2,0,7)],now);
  const events = extractQuestEvents('/api_req_kousyou/destroyitem2',{},new Map([['api_slotitem_ids','19,20,21']]),context());
  counter.apply(events,now);
  assert.equal(counter.progress(613).label,'≈1/24');
  assert.equal(counter.progress(678).label,'≈2/8');
});
test('development batches, expedition success, supply and modernization materials follow poi counting units', () => {
  assert.equal(extractQuestEvents('/api_req_kousyou/createitem',{api_get_items:[{},{},{}]},new Map(),context())[0].delta,3);
  assert.equal(extractQuestEvents('/api_req_mission/result',{api_clear_result:0},new Map(),context()).length,0);
  assert.equal(extractQuestEvents('/api_req_hokyu/charge',{},new Map(),context())[0].delta,1);
  assert.equal(extractQuestEvents('/api_req_kaisou/powerup',{api_powerup_flag:0},new Map(),context()).length,0);
  const event = extractQuestEvents('/api_req_kaisou/powerup',{api_powerup_flag:1},new Map([['api_id_items','2,2,3']]),context())[0];
  assert.ok(matchesQuestGoal(goal({event:'remodel_ship',materialShipType:[2],materialShipMinCount:2}),event));
  assert.equal(matchesQuestGoal(goal({event:'remodel_ship',materialShipType:[2],materialShipMinCount:3}),event),false);
});
test('all bundled poi rules use supported fields and event names', () => {
  const fields = new Set(['key','event','description','required','init','maparea','mapcell','flagshiptype','flagshipclass',
    'secondshipclass','flagshipId','secondshipId','escortshipId','escortshipIdAll','escortshiptype','escortshipclass',
    'banshiptype','fleetlimit','shipType','mission','times','slotitemType2','slotitemId','materialShipType','materialShipMinCount']);
  const events = new Set(['battle_win','battle','battle_boss_win','sinking','battle_rank_s','battle_boss','sally',
    'battle_boss_win_rank_s','battle_boss_win_rank_a','practice','practice_win','practice_win_s','practice_win_a',
    'mission_success','supply','repair','create_ship','create_item','destroy_ship','destory_item','remodel_item','remodel_ship','reach_mapcell']);
  assert.equal(definitions.length,425);
  for(const def of definitions) for(const g of def.goals) {
    for(const field of Object.keys(g)) assert.ok(fields.has(field),`Unsupported field ${field}`);
    assert.ok(events.has(g.event),`Unsupported event ${g.event}`);
    assert.ok(Number.isInteger(g.required) && g.required>0);
  }
  const nations=JSON.parse(fs.readFileSync(path.join(resources,'quest_nations.json'),'utf8'));
  for(const def of formations) for(const rule of def.要求) for(const nation of rule.国籍??[]) {
    assert.ok(nations[nation]?.length,`Missing nationality ${nation}`);
  }
});

function serviceHarness(storage = new Map()) {
  const state = { admiral: {memberId:101}, quests:[], decks:[], ships:new Map(), slotItemIndex:new Map(), slotItemEquipTypes:new Map() };
  let failSave = false;
  let sortie = null;
  const adapters = {
    '@ohos.util': {default:{TextDecoder}},
    '../../infra/appContext': {getAppContext:()=>({resourceManager:{getRawFileContent: async file=>
      fs.readFileSync(path.join(resources,path.basename(file)))}})},
    '../../infra/storage/db': {getActiveUserKey:()=>String(state.admiral.memberId)},
    '../../infra/storage/kv': {kvGetString:async(key,def)=>storage.get(key)??def, kvSet:async(key,value)=>{
      if(failSave) { failSave=false; throw new Error('temporary write failure'); } storage.set(key,value);
    }},
    '../../infra/storage/dao/ship': {listMasters:async()=>[]},
    '../../domain/service/sortie': {getSortieContext:()=>sortie},
    '../simulator/battle_prediction_service': {getBattlePredictionService:()=>({getCurrentSnapshot:()=>({
      enemyFleet:[{shipId:15,nowHP:0}],enemyEscort:[]})})},
    '../state': {getGameState:()=>({getState:()=>state}),updateQuests:quests=>{state.quests=quests}},
    '../utils/common': {parseSvdata:text=>JSON.parse(text.replace(/^svdata=/,''))},
  };
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.join(root,'service.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
  }).outputText;
  new Function('require','module','exports',code)(name=>{
    if(adapters[name])return adapters[name];
    assert.ok(name.startsWith('./'),`Unexpected service dependency: ${name}`);
    return load(name);
  },module,module.exports);
  const service=module.exports;
  return {state,storage,service,failNextSave:()=>{failSave=true;},setSortie:value=>{sortie=value;},
    sync: (rows,page=1,pageCount=1,count=rows.length,tabId=0)=>service.syncQuestPage({
      quests:rows,page,pageCount,count,tabId,updatedAt:Date.now(),completedKind:0}),
    api:(url,data={},params='',result=1)=>service.trackQuestApi({type:'API_DUMP',url:`https://game.example/kcsapi${url}`,
      requestBody:params,responseText:'svdata='+JSON.stringify({api_result:result,api_data:data})})};
}
test('real service merges pages, saves counters, restores after restart and isolates accounts', async () => {
  const h=serviceHarness();
  await h.sync([quest(503)],1,2,2);
  await h.sync([quest(504)],2,2,2);
  assert.deepEqual(h.state.quests.map(q=>q.questId),[503,504]);
  await h.api('/api_req_nyukyo/start');
  assert.equal(h.service.questProgress(503).label,'≈1/5');
  const restarted=serviceHarness(h.storage);
  await restarted.service.initializeQuestTracking();
  assert.equal(restarted.service.questProgress(503).label,'≈1/5');
  restarted.state.admiral.memberId=202;
  await restarted.service.initializeQuestTracking();
  assert.equal(restarted.service.questProgress(503),null);
  await restarted.sync([quest(503)]);
  assert.equal(restarted.service.questProgress(503).label,'≈0/5');
  restarted.state.admiral.memberId=101;
  await restarted.service.initializeQuestTracking();
  assert.equal(restarted.service.questProgress(503).label,'≈1/5');
});
test('service ignores failed API responses and serializes rapid successful operations without losing saved counts', async () => {
  const h=serviceHarness(); await h.sync([quest(503)]);
  await h.api('/api_req_nyukyo/start',{},'',0);
  assert.equal(h.service.questProgress(503).label,'≈0/5');
  await Promise.all([h.api('/api_req_nyukyo/start'),h.api('/api_req_nyukyo/start'),h.api('/api_req_nyukyo/start')]);
  assert.equal(h.service.questProgress(503).label,'≈3/5');
  h.failNextSave(); await assert.rejects(h.api('/api_req_nyukyo/start'));
  await h.api('/api_port/port');
  const restarted=serviceHarness(h.storage); await restarted.service.initializeQuestTracking();
  assert.equal(restarted.service.questProgress(503).label,'≈4/5');
});
test('service reads equipment before deletion, refreshes first-fleet eligibility after edits, and deduplicates battle results', async () => {
  const h=serviceHarness();
  await h.api('/api_start2',{api_mst_ship:[{api_id:1,api_name:'川内',api_stype:3},{api_id:2,api_name:'吹雪',api_stype:2},
    {api_id:3,api_name:'白雪',api_stype:2},{api_id:15,api_name:'輸送ワ級',api_stype:15}]});
  h.state.ships=new Map([[1,{masterId:1,level:50}],[2,{masterId:2,level:50}],[3,{masterId:3,level:50}]]);
  h.state.decks=[{deckId:1,shipUids:[1,2,3]}];
  assert.ok(h.service.firstFleetSatisfiesQuest(206));
  h.state.decks[0].shipUids=[2,1,3]; assert.equal(h.service.firstFleetSatisfiesQuest(206),false);
  await h.sync([quest(678,2,0,7),quest(210)]);
  h.state.slotItemIndex.set(123,19); h.state.slotItemEquipTypes.set(19,6);
  await h.api('/api_req_kousyou/destroyitem2',{},'api_slotitem_ids=123');
  h.state.slotItemIndex.delete(123); assert.equal(h.service.questProgress(678).label,'≈1/8');
  h.setSortie({sortieId:'s1',pendingBattle:{startedAt:1},deckId:1,mapAreaId:2,mapInfoNo:5,
    fleetSnapshot:{ships:[{uid:1},{uid:2},{uid:3}]},currentCell:{cellId:10,isBoss:true}});
  await h.api('/api_req_sortie/battleresult',{api_win_rank:'S'});
  await h.api('/api_req_sortie/battleresult',{api_win_rank:'S'});
  assert.equal(h.service.questProgress(210).label,'≈1/10');
});
