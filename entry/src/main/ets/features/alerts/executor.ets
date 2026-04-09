/**
 * Alert Executor - 执行具体的通知动作
 *
 * 订阅 AlertBus，根据配置执行 Toast / 震动 / 系统通知
 */

import promptAction from '@ohos.promptAction';
import vibrator from '@ohos.vibrator';
import notificationManager from '@ohos.notificationManager';

import type {
  AnyAlert,
  ExpeditionReturnAlert,
  YasenPromptAlert,
  TaihaWarningAlert,
  SortieNextAlert
} from './type';
import { getAlertBus } from '.';
import { getExpeditionLiveNotificationService } from './module/expeditionNotification';
import { getMissionName } from './module/missionCache';

// ========== 通知 ID 常量 ==========
const NOTIFICATION_ID_EXPEDITION_BASE = 1000;
const NOTIFICATION_ID_YASEN = 2000;
const NOTIFICATION_ID_TAIHA = 2001;
const NOTIFICATION_ID_SORTIE_NEXT = 2002;
// ========== 执行函数 ==========

async function executeToast(message: string, duration: number = 2000): Promise<void> {
  try {
    promptAction.showToast({ message, duration });
  } catch (e) {
    console.warn('[AlertExecutor] toast failed:', e);
  }
}

async function executeVibrate(durationMs: number): Promise<void> {
  try {
    await vibrator.startVibration(
      { type: 'time', duration: durationMs },
      { id: 0, usage: 'alarm' }
    );
  } catch (e) {
    console.warn('[AlertExecutor] vibrate failed:', e);
  }
}

async function executeNotification(
  id: number,
  title: string,
  text: string,
  additionalText?: string
): Promise<void> {
  try {
    await notificationManager.publish({
      id,
      content: {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
        normal: { title, text, additionalText },
      },
    });
  } catch (e) {
    console.warn('[AlertExecutor] notification failed:', e);
  }
}

// ========== Alert 处理函数 ==========

async function handleExpeditionReturn(alert: ExpeditionReturnAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  const deckId = alert.deckId;
  const missionName = getMissionName(alert.missionId);
  const timeStr = new Date(alert.timestamp).toLocaleTimeString();
  const body = `第 ${deckId} 舰队「${missionName}」已返回`;

  if (config.enableToast) {
    await executeToast(body);
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_EXPEDITION_BASE + deckId,
      '远征归来',
      body,
      timeStr
    );
  }

  // 归来后刷新常驻通知（移除已完成舰队，保留仍在远征的舰队）
  void getExpeditionLiveNotificationService().refresh();
}

async function handleYasenPrompt(alert: YasenPromptAlert): Promise<void> {
  const config = getAlertBus().getConfig();

  console.info(`[AlertExecutor] yasen prompt: yes=${alert.yesTex}, no=${alert.noTex}`);

  if (config.enableToast) {
    await executeToast('夜战选择');
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_YASEN,
      '夜战选择出现',
      '请选择：夜战突入 / 追撃せず',
      alert.containerName || undefined
    );
  }
}

async function handleTaihaWarning(alert: TaihaWarningAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  const names = alert.shipNames?.join('、') || alert.shipUids.map(u => `#${u}`).join('、');

  console.warn(`[AlertExecutor] TAIHA WARNING: ${names}`);

  if (config.enableToast) {
    await executeToast(`⚠️ 大破警告：${names}`, 3000);
  }

  if (config.enableVibrate) {
    // 大破警告：震动两次
    await executeVibrate(config.vibrateDurationMs);
    setTimeout(() => {
      void executeVibrate(config.vibrateDurationMs);
    }, config.vibrateDurationMs + 100);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_TAIHA,
      '⚠️ 大破警告',
      `${names} 已大破，请注意！`
    );
  }
}

async function handleSortieNext(alert: SortieNextAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  const mapAreaId = alert.mapAreaId;
  const mapInfoNo = alert.mapInfoNo;
  const cellId = alert.cellId;
  const eventDesc = alert.eventDesc;
  const isBoss = alert.isBoss;
  
  const mapStr = `${mapAreaId}-${mapInfoNo}`;
  const bossStr = isBoss ? ' [BOSS]' : '';
  const message = `${mapStr} → ${cellId}${bossStr}: ${eventDesc}`;

  console.info(`[AlertExecutor] sortie next: ${message}`);

  if (config.enableToast) {
    await executeToast(message, isBoss ? 3000 : 2000);
  }

  // Boss 点额外震动
  if (config.enableVibrate && isBoss) {
    await executeVibrate(config.vibrateDurationMs * 2);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_SORTIE_NEXT,
      isBoss ? '🎯 到达 BOSS 点' : '进击中',
      message
    );
  }
}

// ========== 主处理函数 ==========

async function handleAlert(alert: AnyAlert): Promise<void> {
  switch (alert.type) {
    case 'expedition_return':
      await handleExpeditionReturn(alert);
      break;
    case 'yasen_prompt':
      await handleYasenPrompt(alert);
      break;
    case 'taiha_warning':
      await handleTaihaWarning(alert);
      break;
    case 'sortie_next':
      await handleSortieNext(alert);
      break;
  }
}

// ========== Initialize ==========

let initialized = false;

export function initAlertExecutor(): void {
  if (initialized) return;
  initialized = true;

  getAlertBus().subscribeAll(handleAlert);
  console.info('[AlertExecutor] initialized');
}
