import { getAlertBus } from "./bus";
import { ExpeditionReturnAlert, YasenPromptAlert, TaihaWarningAlert, AnyAlert } from "./type";
import { promptAction } from "@kit.ArkUI";
import { notificationManager } from "@kit.NotificationKit";
import { vibrator } from "@kit.SensorServiceKit";
/**
 * Alert Executor
 *
 * subscribe AlertBus，doing Toast / vibration/ inform
 */
// ==========  ID  ==========
const NOTIFICATION_ID_EXPEDITION_BASE = 1000;
const NOTIFICATION_ID_YASEN = 2000;
const NOTIFICATION_ID_TAIHA = 2001;

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

async function executeNotification(id: number, title: string, text: string, additionalText?: string): Promise<void> {
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
  const timestamp = alert.timestamp;
  const deckId = alert.deckId;
  const missionId = alert.missionId;
  const timeStr = new Date(timestamp).toLocaleTimeString();

  if (config.enableToast) {
    await executeToast(`第 ${deckId} 舰队远征 ${missionId} 已返回`);
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_EXPEDITION_BASE + deckId,
      '远征归来',
      `第 ${deckId} 舰队远征 ${missionId} 已返回`,
      timeStr
    );
  }
}

async function handleYasenPrompt(alert: YasenPromptAlert): Promise<void> {
  const config = getAlertBus().getConfig();

  console.info(`[AlertExecutor] yasen prompt: yes=${alert.yesTex}, no=${alert.noTex}`);

  if (config.enableToast) {
    await executeToast('夜战!');
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
    setTimeout(() => executeVibrate(config.vibrateDurationMs), config.vibrateDurationMs + 100);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_TAIHA,
      '⚠️ 大破警告',
      `${names} 已大破，请注意！`
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