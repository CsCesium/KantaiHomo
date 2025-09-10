export interface Cancelable {
  cancel(): void;
}
export type TimeoutId = number;

export interface Clock {
  now(): number;
  setTimeout(cb: () => void, ms: number): Cancelable;
  clearTimeout(handle: Cancelable): void;
}

export interface Notifier {
  notifyExpeditionReturn(deckId: number, missionId: number, when: number): Promise<void>;
  notifyYasenPrompt(yesId: string, noId: string, containerName: string, when: number): Promise<void>;
}

export interface ExpeditionNext {
  deckId: number;
  missionId: number;
  returnTime: number;
}

export interface ExpeditionDaoLike {
  getNextExpeditionAfter(nowMs: number): Promise<ExpeditionNext | null>;
}