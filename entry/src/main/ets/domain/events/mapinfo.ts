import { PayloadEvent } from './type';

/** Single map gauge snapshot */
export interface MapGaugeRaw {
  /** Map compound ID: area * 10 + no (e.g. 15 = 1-5, 25 = 2-5) */
  mapId: number;
  cleared: boolean;
  defeatCount: number;
  /** 1 = HP gauge, 2 = TP gauge, null = no gauge */
  gaugeType: number | null;
  gaugeNum: number;
  hpNow: number | null;
  hpMax: number | null;
  requiredDefeats: number | null;
}

export type MapInfoUpdateEvent = PayloadEvent<'MAP_INFO_UPDATE', MapGaugeRaw[]>;
export type AnyMapInfoEvt = MapInfoUpdateEvent;
