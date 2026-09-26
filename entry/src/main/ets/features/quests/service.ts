import util from '@ohos.util';
import { getAppContext } from '../../infra/appContext';
import { getActiveUserKey } from '../../infra/storage/db';
import { kvGetString, kvSet } from '../../infra/storage/kv';
import { listMasters } from '../../infra/storage/dao/ship';
import type { ApiDump } from '../../infra/web/types';
import type { QuestListPage } from '../../domain/models/struct/quest';
import { getSortieContext } from '../../domain/service/sortie';
import { getBattlePredictionService } from '../simulator/battle_prediction_service';
import { getGameState, updateQuests } from '../state';
import { parseSvdata } from '../utils/common';
import { QuestCounter } from './counter';
import { satisfiesQuestFormation } from './formation';
import { extractQuestEvents, QuestApiData, QuestEventContext, QuestBattleContext } from './events';
import { QuestShipCatalog, QuestShipMaster } from './shipMetadata';
import type { QuestFleetShip, QuestFormationDefinition, QuestGoalFile, QuestProgressView } from './types';

interface QuestRawMaster { api_id: number; api_name: string; api_stype?: number; api_ctype?: number; api_aftershipid?: string; }
interface QuestResponseData extends QuestApiData {
  api_mst_ship?: QuestRawMaster[];
  api_basic?: { api_member_id?: string | number };
}
interface QuestResponse { api_result?: number; api_data?: QuestResponseData; }

let counter: QuestCounter | null = null;
let formations: QuestFormationDefinition[] = [];
const catalog = new QuestShipCatalog();
let account = '';
let queue: Promise<void> = Promise.resolve();
let initialized: Promise<void> | null = null;
let lastBattleKey = '';
const listeners = new Set<() => void>();
let lastSaved = '';
const TRACKED_ENDPOINTS = new Set<string>([
  '/api_start2', '/api_start2/getData', '/api_port/port', '/api_req_practice/battle_result',
  '/api_req_sortie/battleresult', '/api_req_combined_battle/battleresult', '/api_req_mission/result',
  '/api_req_map/start', '/api_req_map/next', '/api_req_nyukyo/start', '/api_req_hokyu/charge',
  '/api_req_kousyou/createitem', '/api_req_kousyou/createship', '/api_req_kousyou/destroyship',
  '/api_req_kousyou/remodel_slot', '/api_req_kaisou/powerup', '/api_req_kousyou/destroyitem2',
]);

async function readResource(file: string): Promise<string> {
  const content = await getAppContext().resourceManager.getRawFileContent(`data/${file}`);
  return new util.TextDecoder('utf-8').decode(content);
}
async function loadData(): Promise<void> {
  const data = await Promise.all([readResource('quest_req.json'), readResource('quest_goals.json'),
    readResource('quest_nations.json')]);
  formations = JSON.parse(data[0]) as QuestFormationDefinition[];
  counter = new QuestCounter((JSON.parse(data[1]) as QuestGoalFile).quests);
  catalog.setNations(JSON.parse(data[2]) as Record<string, number[]>);
}
function notify(): void { listeners.forEach(listener => listener()); }
function publishQuests(): void {
  if (counter) updateQuests(counter.quests(), true);
  notify();
}
function serializeOperation(operation: () => Promise<void>): Promise<void> {
  const next = queue.then(operation);
  queue = next.catch(error => { console.warn('[quests] update failed:', String(error)); });
  return next;
}
async function ensureAccount(key?: string): Promise<void> {
  if (!initialized) initialized = loadData().catch(error => { initialized = null; throw error; });
  await initialized;
  const next = key || String(getGameState().getState().admiral?.memberId || getActiveUserKey());
  if (account === next) return;
  if (account) await save();
  const saved = next !== 'default' ? await kvGetString(`quests.counter.v1.${next}`, '') : '';
  account = next; lastBattleKey = ''; lastSaved = saved;
  try { counter?.restore(saved, Date.now()); }
  catch (error) { counter?.restore('', Date.now()); console.warn('[quests] invalid saved counters:', String(error)); }
  try { catalog.setMasters(await listMasters()); }
  catch (error) { console.warn('[quests] master cache unavailable:', String(error)); }
  publishQuests();
}
async function save(): Promise<void> {
  const text = counter?.serialize() ?? '';
  if (account !== 'default' && text !== lastSaved) {
    await kvSet(`quests.counter.v1.${account}`, text);
    lastSaved = text;
  }
}
export function initializeQuestTracking(): Promise<void> {
  return serializeOperation(async () => { await ensureAccount(); if (counter?.expire(Date.now())) publishQuests(); await save(); });
}
export function subscribeQuestTracking(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function questProgress(id: number): QuestProgressView | null { return counter?.progress(id) ?? null; }
function fleetFromUids(uids: number[]): QuestFleetShip[] {
  const state = getGameState().getState();
  const result: QuestFleetShip[] = [];
  uids.forEach((uid, index) => {
    if (uid <= 0) return;
    const ship = state.ships.get(uid);
    result.push(catalog.ship(uid, ship?.masterId ?? 0, ship?.level ?? 0, index + 1));
  });
  return result;
}
function fleet(deckId: number): QuestFleetShip[] {
  return fleetFromUids(getGameState().getState().decks.find(deck => deck.deckId === deckId)?.shipUids ?? []);
}
export function firstFleetSatisfiesQuest(id: number): boolean {
  return satisfiesQuestFormation(id, fleet(1), formations);
}

export function syncQuestPage(page: QuestListPage): Promise<void> {
  return serializeOperation(async () => {
    await ensureAccount();
    const rows = page.quests.map(quest => ({ ...quest, capturedAt: page.updatedAt }));
    const full = counter?.pages.collect(page, rows);
    counter?.sync(full ?? rows, page.updatedAt, full !== null && full !== undefined);
    counter?.reconcileActiveCount(page.activeCount, full ?? rows);
    publishQuests(); await save();
  });
}
export function changeTrackedQuestState(id: number, state: number, now: number): Promise<void> {
  return serializeOperation(async () => {
    await ensureAccount(); counter?.changeState(id, state, now); publishQuests(); await save();
  });
}
export function claimTrackedQuest(id: number): Promise<void> {
  return serializeOperation(async () => {
    await ensureAccount(); counter?.claim(id); publishQuests(); await save();
  });
}

/** Capture pre-mutation data: destroyed equipment, consumed ships and final battle HP. */
export function trackQuestApi(dump: ApiDump): Promise<void> {
  const endpoint = dump.url.match(/(\/api_[^?#]+)/)?.[1] ?? '';
  if (!TRACKED_ENDPOINTS.has(endpoint)) return Promise.resolve();
  return serializeOperation(async () => {
    const root = parseSvdata<QuestResponse>(dump.responseText);
    if (root?.api_result !== 1) return;
    const data = root.api_data ?? {};
    const portId = endpoint === '/api_port/port' ? data.api_basic?.api_member_id : undefined;
    await ensureAccount(portId ? String(portId) : undefined);
    if (data.api_mst_ship) {
      const masters: QuestShipMaster[] = data.api_mst_ship.map(ship => ({ id: ship.api_id, name: ship.api_name,
        stype: ship.api_stype ?? 0, ctype: ship.api_ctype ?? 0, afterShipId: Number(ship.api_aftershipid) || null }));
      catalog.setMasters(masters); notify();
    }
    const state = getGameState().getState();
    const sortie = getSortieContext();
    const isResult = /\/(battleresult|battle_result)$/.test(endpoint);
    let battle: QuestBattleContext | undefined;
    if (isResult && sortie?.pendingBattle) {
      const snapshot = getBattlePredictionService().getCurrentSnapshot();
      const ships = [...sortie.fleetSnapshot.ships, ...(sortie.fleetSnapshotEscort?.ships ?? [])];
      battle = { key: `${sortie.sortieId}:${sortie.pendingBattle.startedAt}`, fleet: fleetFromUids(ships.map(ship => ship.uid)),
        maparea: sortie.mapAreaId * 10 + sortie.mapInfoNo, mapcell: sortie.currentCell?.cellId ?? 0,
        boss: sortie.currentCell?.isBoss ?? false,
        enemies: [...(snapshot?.enemyFleet ?? []), ...(snapshot?.enemyEscort ?? [])]
          .map(ship => ({ masterId: ship.shipId, hp: ship.nowHP })) };
    }
    if (isResult && battle?.key === lastBattleKey) return;
    const params = new Map<string, string>();
    for (const part of (dump.requestBody ?? '').split('&')) {
      const index = part.indexOf('=');
      if (index > 0) params.set(decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1).replace(/\+/g, ' ')));
    }
    const context: QuestEventContext = { battle, fleet, sortieDeckId: sortie?.deckId ?? 1,
      shipType: uid => catalog.stype(state.ships.get(uid)?.masterId ?? 0),
      enemyType: id => catalog.stype(id),
      equip: uid => { const id = state.slotItemIndex.get(uid); return id ? { id, type: state.slotItemEquipTypes.get(id) ?? 0 } : undefined; } };
    const events = extractQuestEvents(endpoint, data, params, context);
    if (isResult && battle) lastBattleKey = battle.key;
    const expired = counter?.expire(Date.now());
    const changed = counter?.apply(events, Date.now());
    // Buttons and the tri-fold card subscribe to game state, including local completion.
    if (expired || changed) publishQuests();
    await save();
  });
}
