import { getWsClient } from '../../infra/net/wsClient';
import type { BaseMsg, YasenPrompt } from '../../infra/net/wsClient/types';
import type {Notifier} from './type'

export interface YasenCtx {
  ts: number;
  yesId: string;
  noId: string;
  containerName: string;
}

// —— 去重 + 节流（默认 1200ms 内同一提示不重复）
const COOLDOWN_MS: number = 1200;
let lastEmitAt: number = 0;
let lastSig: string = '';

function shouldNotify(ts: number, sig: string): boolean {
  if (sig === lastSig && ts - lastEmitAt < COOLDOWN_MS) { return false; }
  lastEmitAt = ts;
  lastSig = sig;
  return true;
}

function safeStr(v: string | undefined | null): string {
  return v === undefined || v === null ? '' : v;
}

/** 订阅 ws 事件，接入 UI 提醒 */
export function initYasenNotifier(notifier: Notifier): void {
  const ws = getWsClient();
  ws.subscribeType('YasenPromptDetected', (msg): void => {
    const payload: YasenPrompt = (msg as BaseMsg<YasenPrompt>).payload;
    const nowTs: number = msg.ts !== undefined ? msg.ts : Date.now();
    const sig: string = payload.yesTex + '|' + payload.noTex + '|' + safeStr(payload.container);
    if (!shouldNotify(nowTs, sig)) return;

    void notifier.notifyYasenPrompt(
      payload.yesTex,
      payload.noTex,
      safeStr(payload.container),
      nowTs
    );
  });
}