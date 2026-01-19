import type { PayloadEvent } from './type';
export type SessionBind = {memberId: string; }
export type SessionBindEvent = PayloadEvent<'SESSION_BIND', SessionBind>;