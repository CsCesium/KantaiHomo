import type { QuestCountEvent, QuestFleetShip } from './types';

export interface QuestBattleContext {
  key: string;
  fleet: QuestFleetShip[];
  maparea: number;
  mapcell: number;
  boss: boolean;
  enemies: { masterId: number; hp: number }[];
}
export interface QuestEventContext {
  battle?: QuestBattleContext;
  fleet: (deckId: number) => QuestFleetShip[];
  shipType: (uid: number) => number;
  enemyType: (masterId: number) => number;
  equip: (uid: number) => { id: number; type: number } | undefined;
  sortieDeckId: number;
}
export interface QuestApiData {
  api_win_rank?: string;
  api_clear_result?: number;
  api_quest_name?: string;
  api_get_items?: object[];
  api_create_flag?: number;
  api_powerup_flag?: number;
  api_remodel_flag?: number;
  api_maparea_id?: number;
  api_mapinfo_no?: number;
  api_no?: number;
}
function ids(text: string | undefined): number[] {
  return (text ?? '').split(',').map(value => Number(value)).filter(id => Number.isInteger(id) && id > 0);
}
export function extractQuestEvents(
  endpoint: string, data: QuestApiData, params: Map<string, string>, context: QuestEventContext
): QuestCountEvent[] {
  const events: QuestCountEvent[] = [];
  const add = (event: string, delta = 1): void => { events.push({ event, delta }); };
  if (endpoint === '/api_req_practice/battle_result' || endpoint === '/api_req_sortie/battleresult' ||
      endpoint === '/api_req_combined_battle/battleresult') {
    const battle = context.battle;
    if (!battle) return events;
    const practice = endpoint === '/api_req_practice/battle_result';
    const rank = data.api_win_rank ?? '';
    const win = ['S', 'A', 'B'].includes(rank);
    const emit = (event: string): void => {
      events.push({ event, delta: 1, fleet: battle.fleet, maparea: battle.maparea, mapcell: battle.mapcell });
    };
    if (practice) {
      emit('practice');
      if (win) emit('practice_win');
      if (['S', 'A'].includes(rank)) emit('practice_win_a');
      if (rank === 'S') emit('practice_win_s');
    } else {
      emit('battle');
      if (win) emit('battle_win');
      if (rank === 'S') emit('battle_rank_s');
      if (battle.boss) {
        emit('battle_boss');
        if (win) emit('battle_boss_win');
        if (['S', 'A'].includes(rank)) emit('battle_boss_win_rank_a');
        if (rank === 'S') emit('battle_boss_win_rank_s');
      }
      for (const enemy of battle.enemies) {
        if (enemy.masterId > 0 && Number.isFinite(enemy.hp) && enemy.hp <= 0) {
          events.push({ event: 'sinking', delta: 1, shipType: context.enemyType(enemy.masterId),
            maparea: battle.maparea, mapcell: battle.mapcell, fleet: battle.fleet });
        }
      }
    }
  } else if (endpoint === '/api_req_mission/result') {
    if ((data.api_clear_result ?? 0) > 0) events.push({ event: 'mission_success', delta: 1, mission: data.api_quest_name });
  } else if (endpoint === '/api_req_map/start' || endpoint === '/api_req_map/next') {
    if (endpoint.endsWith('/start')) add('sally');
    if (data.api_maparea_id && data.api_mapinfo_no && data.api_no !== undefined) {
      events.push({ event: 'reach_mapcell', delta: 1, maparea: data.api_maparea_id * 10 + data.api_mapinfo_no,
        mapcell: data.api_no, fleet: context.fleet(Number(params.get('api_deck_id')) || context.sortieDeckId) });
    }
  } else if (endpoint === '/api_req_nyukyo/start') add('repair');
  else if (endpoint === '/api_req_hokyu/charge') add('supply');
  else if (endpoint === '/api_req_kousyou/createitem') {
    // Failed developments also count; each element represents one development attempt.
    add('create_item', data.api_get_items?.length ?? 1);
  } else if (endpoint === '/api_req_kousyou/createship') add('create_ship');
  else if (endpoint === '/api_req_kousyou/destroyship') add('destroy_ship', ids(params.get('api_ship_id')).length);
  else if (endpoint === '/api_req_kousyou/remodel_slot') add('remodel_item');
  else if (endpoint === '/api_req_kaisou/powerup' && data.api_powerup_flag === 1) {
    events.push({ event: 'remodel_ship', delta: 1, times: 1,
      materialShipTypes: ids(params.get('api_id_items')).map(uid => context.shipType(uid)) });
  } else if (endpoint === '/api_req_kousyou/destroyitem2') {
    const selected = ids(params.get('api_slotitem_ids'));
    for (const uid of selected) {
      const equip = context.equip(uid);
      if (equip) events.push({ event: 'destory_item', delta: 1, slotitemType2: equip.type, slotitemId: equip.id });
    }
    // poi's legacy spelling is retained only as a key in its rule data.
    // A disposal operation and each disposed equipment are separate counting units.
    if (selected.length) events.push({ event: 'destory_item', delta: 1, times: 1 });
  }
  return events;
}
