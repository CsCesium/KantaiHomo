//src/main/ets/domain/events/type.ts
export type EventType =
  // Session
  | 'SESSION_BIND'
  //start
  |  'SHIP_MASTER_CATALOG'
  |  'SLOTITEM_MASTER_CATALOG'
  |  'MISSION_MASTER_CATALOG'
  |  'USEITEM_MASTER_CATALOG'
  |  'SHIP_GRAPH_CATALOG'
  // Port
    | 'PORT_SNAPSHOT'
    | 'PORT_BASIC'
    | 'PORT_RESOURCES'
    | 'PORT_FLEETS'
    | 'PORT_NDOCK'
    | 'PORT_KDOCK'
    | 'PORT_SHIPS'
  // SlotItem
    | 'SLOTITEMS_UPDATE'
  // Require Info (login full-state push: admiral + kdocks + useitems)
    | 'REQUIRE_INFO_UPDATE'
  // Expedition
    | 'EXPEDITION_START'
    | 'EXPEDITION_UPDATE'
    | 'EXPEDITION_RESULT'
    | 'EXPEDITION_CATALOG'
  // Quest
    | 'QUEST_LIST'
    | 'QUEST_CLAIMED'
  // Sortie
    | 'SORTIE_START'
    | 'SORTIE_NEXT'
  // Battle
    | 'BATTLE_DAY'
    | 'BATTLE_NIGHT'
    | 'BATTLE_RESULT'
  // Supply
    | 'SUPPLY_CHARGE'
  // Ranking
    | 'RANKING_SNAPSHOT'
  // Map Info
    | 'MAP_INFO_UPDATE'
  // LBAS
    | 'LBAS_UPDATE'
  // Supply
    | 'SUPPLY_CHARGE'
  // Kousyou (工厂: 开发/建造/改修)
    | 'KOUSYOU_DEV_RESULT'
    | 'KOUSYOU_GETSHIP_RESULT'
    | 'KOUSYOU_REMODEL_RESULT'
    | 'KOUSYOU_CREATESHIP_START'
    | 'KOUSYOU_KDOCK_UPDATE'
  // UI
    | 'YASEN_DETECTED'
    | 'TAIHA_WARNING';

export interface EventBase {
  id: string;
  timestamp: number;
  source: 'web' | 'vpn' | 'companion';
  endpoint: string;
  schemaVersion?: number;
}

export type PayloadEvent<T extends EventType, P> = EventBase & {
  type: T;
  payload: P;
};
