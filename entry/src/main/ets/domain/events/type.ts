//src/main/ets/domain/events/type.ts
export type EventType =
  // Session
  | 'SESSION_BIND'
  // Port
    | 'PORT_SNAPSHOT'
    | 'PORT_BASIC'
    | 'PORT_RESOURCES'
    | 'PORT_FLEETS'
    | 'PORT_NDOCK'
    | 'PORT_KDOCK'
    | 'PORT_SHIPS'
    | 'PORT_SLOTITEMS'
  // Expedition
    | 'EXPEDITION_START'
    | 'EXPEDITION_UPDATE'
    | 'EXPEDITION_RESULT'
    | 'EXPEDITION_CATALOG'
  // Sortie
    | 'SORTIE_START'
    | 'SORTIE_NEXT'
  // Battle
    | 'BATTLE_DAY'
    | 'BATTLE_NIGHT'
    | 'BATTLE_RESULT';

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
