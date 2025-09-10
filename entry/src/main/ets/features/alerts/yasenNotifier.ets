import notificationManager from '@ohos.notificationManager';
import vibrator from '@ohos.vibrator';
import promptAction from '@ohos.promptAction';
import {BusinessError} from '@kit.BasicServicesKit'
import { getWsClient } from '../../infra/net/wsClient';
import type { BaseMsg, YasenPrompt } from '../../infra/net/wsClient/types';
import { kvGetBool } from '../../infra/store/kv';

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
export function initYasenNotifier(): void {
  const ws = getWsClient();
  ws.subscribeType('YasenPromptDetected', (msg): void => {
    const payload: YasenPrompt = (msg as BaseMsg<YasenPrompt>).payload;
    const nowTs: number = msg.ts !== undefined ? msg.ts : Date.now();
    const sig: string = payload.yesTex + '|' + payload.noTex + '|' + safeStr(payload.container);
    if (!shouldNotify(nowTs, sig)) { return; }

    void notifyYasenPrompt({
      ts: nowTs,
      yesId: payload.yesTex,
      noId: payload.noTex,
      containerName: safeStr(payload.container)
    });
  });
}

export async function notifyYasenPrompt(ctx: YasenCtx): Promise<void> {
  // 总开关
  const enabled: boolean = await kvGetBool('feature.yasenPrompt.enabled', true);
  if (!enabled) { return; }

  const useNotify: boolean = await kvGetBool('feature.yasenPrompt.notify', true);
  const useVibrate: boolean = await kvGetBool('feature.yasenPrompt.vibrate', false);
  const useToast: boolean = await kvGetBool('feature.yasenPrompt.toast', false);

  if (useNotify) {
    try {
      await notificationManager.publish({
        id: 0, // TODO: 可以改成自增或基于时间戳的 id
        content: {
          notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
          normal: {
            title: '夜战选择出现',
            text: '请选择：夜战突入 / 追撃せず',
            additionalText: (ctx.containerName !== '' ? ctx.containerName + ' ' : '') + '(' + ctx.yesId + ' / ' + ctx.noId + ')'
          }
        }
        // TODO：slot/分组/点击行为 WantAgent 等后续补充
      });
    } catch (e) {
      const emsg: string = errToStr(e);
      console.error('[YASEN] publish notification failed: ' + emsg);
    }
  }

  if (useVibrate) {
    try {
      await vibrator.startVibration(
        { type: 'time', duration: 150 }, // 定时震动 150ms
        { id: 0, usage: 'alarm' }       // 或 'unknown'，按需设置
      );
    } catch {
      // 震动不可用时忽略
    }
  }

  if (useToast) {
    try {
      promptAction.showToast({ message: '夜战选择出现：夜战突入 / 追撃せず' });
    } catch {
      // 部分场景没有 UI 容器时可能失败
    }
  }
}

function errToStr(e: BusinessError | Error | string | number | boolean | object | null | undefined): string {
  if (typeof e === 'string') { return e; }
  if (typeof e === 'number') { return String(e); }
  if (typeof e === 'boolean') { return e ? 'true' : 'false'; }
  if (e === null || e === undefined) { return 'null'; }
  if (typeof e === 'object') {
    const beMsg: string = (e as BusinessError).message;
    if (typeof beMsg === 'string' && beMsg.length > 0) { return beMsg; }
    const erMsg: string = (e as Error).message;
    if (typeof erMsg === 'string' && erMsg.length > 0) { return erMsg; }
    try { return JSON.stringify(e); } catch { return 'error'; }
  }
  return 'error';
}