import type { LbasBase } from '../models/struct/lbas';
import type { PayloadEvent } from './type';

/** 基地航空队状态更新（全量替换或单基地补丁） */
export type LbasUpdateEvent = PayloadEvent<'LBAS_UPDATE', LbasBase[]>;

export type AnyLbasEvt = LbasUpdateEvent;
